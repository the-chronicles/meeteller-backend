import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { MeetingInsightsQueue } from './meeting-insights.queue';
import { MeetingInsightsProcessor } from './processors/meeting-insights.processor';
import { QueuesModule } from 'src/queues/queues.module';
import { Transcript } from 'src/transcripts/transcript.entity';
import { MeetingInsight } from './meeting-insight.entity';

@Module({
  imports: [
    QueuesModule,
    TypeOrmModule.forFeature([Transcript, MeetingInsight]),
  ],
  providers: [AiService, MeetingInsightsQueue, MeetingInsightsProcessor],
  controllers: [AiController],
  exports: [MeetingInsightsQueue],
})
export class AiModule {}
