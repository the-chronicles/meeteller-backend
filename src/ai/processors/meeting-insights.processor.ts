import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Transcript } from 'src/transcripts/transcript.entity';
import { MeetingInsight } from '../meeting-insight.entity';
import { AiService } from '../ai.service';

@Processor('meeting-insights')
export class MeetingInsightsProcessor extends WorkerHost {
  constructor(
    private readonly aiService: AiService,
    @InjectRepository(Transcript)
    private readonly transcriptRepo: Repository<Transcript>,
    @InjectRepository(MeetingInsight)
    private readonly meetingInsightRepo: Repository<MeetingInsight>,
  ) {
    super();
  }

  async process(job: Job) {
    const { meetingId, transcriptId } = job.data as {
      meetingId: number;
      transcriptId: number;
    };

    console.log(`Processing meeting insight for meeting ${meetingId}, transcript ${transcriptId}`);

    const transcript = await this.transcriptRepo.findOne({
      where: { id: transcriptId },
      relations: ['segments'],
      order: {
        segments: {
          createdAt: 'ASC',
        },
      },
    });

    if (!transcript) {
      throw new Error(`Transcript with ID ${transcriptId} not found`);
    }

    const transcriptText = transcript.segments
      .map((s) => s.text)
      .join('\n')
      .trim();

    if (!transcriptText) {
      console.log(`Transcript is empty for meeting ${meetingId}. Saving default empty insights.`);
      const insight = this.meetingInsightRepo.create({
        meeting: { id: meetingId } as any,
        summary: 'No transcription recorded for this meeting.',
        actionItems: [],
        keyDecisions: [],
        suggestedTitle: '',
        tags: [],
      });
      await this.meetingInsightRepo.save(insight);
      return true;
    }

    const rawInsights = await this.aiService.generateMeetingInsights(transcriptText);
    if (!rawInsights) {
      throw new Error('Failed to generate insights from AI service');
    }

    let cleaned = rawInsights.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);
      const insight = this.meetingInsightRepo.create({
        meeting: { id: meetingId } as any,
        summary: parsed.summary || '',
        actionItems: parsed.actionItems || [],
        keyDecisions: parsed.keyDecisions || [],
        suggestedTitle: parsed.suggestedTitle || '',
        tags: parsed.tags || [],
      });

      await this.meetingInsightRepo.save(insight);
      console.log(`Saved meeting insight for meeting ${meetingId}`);
    } catch (error) {
      console.error('Failed to parse AI insights JSON:', error, 'Raw response was:', rawInsights);
      throw error;
    }

    return true;
  }
}
