import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranscriptSegment } from './transcript-segment.entity';
import { Transcript } from './transcript.entity';
import { Meeting } from 'src/meetings/meeting.entity';
import { Session } from 'src/realtime/session.entity';
import { SearchService } from '../search/search.service';

@Injectable()
export class TranscriptsService {
  constructor(
    @InjectRepository(Transcript)
    private transcriptRepo: Repository<Transcript>,

    @InjectRepository(TranscriptSegment)
    private segmentRepo: Repository<TranscriptSegment>,

    private readonly searchService: SearchService,
  ) {}

  async createTranscript(meeting: Meeting, session: Session) {
    const transcript = this.transcriptRepo.create({
      meeting,
      session,
      status: 'processing',
    });

    return this.transcriptRepo.save(transcript);
  }

  async addSegment(transcriptId: number, text: string, isFinal: boolean) {
    const transcript = await this.transcriptRepo.findOne({
      where: {
        id: transcriptId,
      },
    });

    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const segment = this.segmentRepo.create({
      transcript,
      text,
      isFinal,
    });

    const saved = await this.segmentRepo.save(segment);

    if (isFinal) {
      this.searchService.generateAndSaveEmbedding(saved.id).catch((err) => {
        console.error(`Failed to generate embedding for segment ${saved.id}:`, err);
      });
    }

    return saved;
  }

  async completeTranscript(transcriptId: number) {
    const transcript = await this.transcriptRepo.findOne({
      where: {
        id: transcriptId,
      },
    });

    if (!transcript) return;

    transcript.status = 'completed';

    return this.transcriptRepo.save(transcript);
  }

  async getTranscriptByMeetingId(meetingId: number) {
    return this.transcriptRepo.findOne({
      where: {
        meeting: {
          id: meetingId,
        },
      },

      relations: ['segments', 'meeting'],

      order: {
        segments: {
          createdAt: 'ASC',
        },
      },
    });
  }
}
