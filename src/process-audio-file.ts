import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RealtimeTranscriptionService } from './realtime/realtime-transcription.service';
import { MeetingInsightsQueue } from './ai/meeting-insights.queue';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { Meeting } from './meetings/meeting.entity';
import { Transcript } from './transcripts/transcript.entity';
import { TranscriptSegment } from './transcripts/transcript-segment.entity';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const email = process.argv[2];
  const filePath = process.argv[3];

  if (!email || !filePath) {
    console.error('Usage: npx ts-node -r tsconfig-paths/register src/process-audio-file.ts <email> <path_to_audio_file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`Reading audio file: ${absolutePath}`);
  const buffer = fs.readFileSync(absolutePath);

  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const transcriptionService = app.get(RealtimeTranscriptionService);
  const queue = app.get(MeetingInsightsQueue);

  // 1. Get user
  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { email } });
  if (!user) {
    console.error(`User with email ${email} not found!`);
    await app.close();
    process.exit(1);
  }

  console.log('Transcribing audio with Deepgram Nova-2...');
  let response;
  try {
    response = await transcriptionService.transcribeFile(buffer);
  } catch (err) {
    console.error('Deepgram transcription failed:', err);
    await app.close();
    process.exit(1);
  }

  const alternatives = response.result?.results?.channels[0]?.alternatives[0];
  const fullText = alternatives?.transcript || '';
  const paragraphs = alternatives?.paragraphs?.paragraphs || [];

  if (!fullText) {
    console.warn('Warning: Deepgram returned an empty transcript.');
  }

  // 2. Create completed meeting in database
  const meetingRepo = dataSource.getRepository(Meeting);
  const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
  let meeting = meetingRepo.create({
    title: `Audio Upload: ${fileNameWithoutExt}`,
    description: `Manually uploaded audio file transcription and AI insights for ${fileNameWithoutExt}.`,
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
  console.log(`Created transcript record: ID ${transcript.id}`);

  // 4. Save segments
  const segmentRepo = dataSource.getRepository(TranscriptSegment);
  let segmentsToCreate: any[] = [];

  if (paragraphs.length > 0) {
    segmentsToCreate = paragraphs.map((p: any) => ({
      speaker: `Speaker ${p.speaker ?? 0}`,
      text: p.sentences.map((s: any) => s.text).join(' '),
      isFinal: true,
      transcript,
    }));
  } else {
    // split text into sentence-like chunks
    const sentences = fullText.match(/[^.!?]+[.!?]+(\s|$)/g) || [fullText];
    segmentsToCreate = sentences.map((sentence: string, index: number) => ({
      speaker: 'Speaker 0',
      text: sentence.trim(),
      isFinal: true,
      transcript,
    }));
  }

  if (segmentsToCreate.length > 0) {
    await segmentRepo.save(segmentRepo.create(segmentsToCreate));
    console.log(`Seeded ${segmentsToCreate.length} transcript segments in DB.`);
  }

  // 5. Trigger BullMQ insights queue
  console.log('Queueing insights generation job...');
  await queue.generateInsights(meeting.id, transcript.id);
  console.log('Insights job added to queue. Waiting 12 seconds for completion...');
  
  await new Promise((resolve) => setTimeout(resolve, 12000));
  
  console.log('----------------------------------------------------');
  console.log(`SUCCESS! Audio transcription and insights generated!`);
  console.log(`Email account: ${email}`);
  console.log(`Meeting URL in frontend: http://localhost:8080/meetings/${meeting.id}`);
  console.log('----------------------------------------------------');
  
  await app.close();
}

bootstrap().catch(console.error);
