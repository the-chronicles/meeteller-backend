import { Module } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

import { SessionService } from './session/session.service';

import { MeetingsModule } from 'src/meetings/meetings.module';

import { TypeOrmModule } from '@nestjs/typeorm';

import { Session } from './session.entity';

import { AudioSessionManager } from './audio-session.manager';

import { RealtimeTranscriptionService } from './realtime-transcription.service';
import { TranscriptsModule } from 'src/transcripts/transcripts.module';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    MeetingsModule,
    TranscriptsModule,
    AiModule,
  ],

  providers: [
    RealtimeGateway,
    SessionService,
    AudioSessionManager,
    RealtimeTranscriptionService,
  ],
})
export class RealtimeModule {}
