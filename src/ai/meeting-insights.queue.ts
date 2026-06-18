import { Injectable } from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';

import { Queue } from 'bullmq';

@Injectable()
export class MeetingInsightsQueue {
  constructor(
    @InjectQueue('meeting-insights')
    private queue: Queue,
  ) {}

  async generateInsights(meetingId: number, transcriptId: number) {
    return this.queue.add('generate-insights', {
      meetingId,
      transcriptId,
    });
  }
}
