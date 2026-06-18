import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MeetingInsightsQueue } from './ai/meeting-insights.queue';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { Meeting } from './meetings/meeting.entity';
import { Transcript } from './transcripts/transcript.entity';
import { TranscriptSegment } from './transcripts/transcript-segment.entity';

async function bootstrap() {
  const email = process.argv[2] || 'oakeredolu72@gmail.com';
  console.log(`Seeding test meeting for user: ${email}`);
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const queue = app.get(MeetingInsightsQueue);

  // 1. Get user
  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { email } });
  if (!user) {
    console.error(`User with email ${email} not found!`);
    await app.close();
    return;
  }

  // 2. Create meeting
  const meetingRepo = dataSource.getRepository(Meeting);
  let meeting = meetingRepo.create({
    title: 'Q3 Product Strategy & Launch Sync',
    description: 'Weekly alignment meeting to lock down our launch date, discuss marketing objectives, and assign tasks.',
    status: 'completed',
    isLive: false,
    isRecording: false,
    owner: user,
  });
  meeting = await meetingRepo.save(meeting);
  console.log(`Created meeting: ID ${meeting.id}`);

  // 3. Create transcript
  const transcriptRepo = dataSource.getRepository(Transcript);
  let transcript = transcriptRepo.create({
    meeting,
    status: 'completed',
  });
  transcript = await transcriptRepo.save(transcript);
  console.log(`Created transcript: ID ${transcript.id}`);

  // 4. Create realistic segments
  const segmentRepo = dataSource.getRepository(TranscriptSegment);
  const segments = [
    { speaker: 'Product Manager', text: 'Thanks everyone for joining. Today we need to align on our Q3 roadmap and finalize our launch strategy.', isFinal: true, transcript },
    { speaker: 'CFO', text: 'Budget-wise, we have approved the additional $20,000 for the marketing campaign, so we are good to go there.', isFinal: true, transcript },
    { speaker: 'PM', text: 'Excellent. What is the target launch date? We had proposed September 15th.', isFinal: true, transcript },
    { speaker: 'Comms Lead', text: 'September 15th works perfectly for marketing. It gives us enough lead time to run the press campaigns.', isFinal: true, transcript },
    { speaker: 'CFO', text: 'Agreed. So September 15th is officially our locked launch date. Let us record that decision.', isFinal: true, transcript },
    { speaker: 'PM', text: 'Perfect. Sarah, please draft the press release and share it with legal by next Monday.', isFinal: true, transcript },
    { speaker: 'Comms Lead', text: 'Will do. I will also coordinate with the design team for the social media assets.', isFinal: true, transcript },
    { speaker: 'CFO', text: 'Great. Let us wrap up this sync and get to work.', isFinal: true, transcript },
  ];
  await segmentRepo.save(segmentRepo.create(segments));
  console.log('Seeded transcript segments.');

  // 5. Trigger insights generation
  console.log('Queueing insights job...');
  await queue.generateInsights(meeting.id, transcript.id);
  console.log('Insights job added to BullMQ. Processor will now parse transcript, invoke Groq AI, and save results.');

  console.log('Waiting 10 seconds for completion...');
  await new Promise((resolve) => setTimeout(resolve, 10000));
  
  console.log(`Done! You can now log into the frontend as ${email} and view the meeting with ID ${meeting.id}.`);
  await app.close();
}

bootstrap().catch(console.error);
