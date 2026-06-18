import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { MeetingsController } from './meetings.controller';

import { MeetingsService } from './meetings.service';

import { Meeting } from './meeting.entity';
import { MeetingInsight } from 'src/ai/meeting-insight.entity';
import { TranscriptsModule } from 'src/transcripts/transcripts.module';
import { WorkspaceMember } from '../workspaces/workspace-member.entity';
import { User } from '../users/user.entity';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingInsight, WorkspaceMember, User]),
    TranscriptsModule,
    IntegrationsModule,
  ],

  controllers: [MeetingsController],

  providers: [MeetingsService],

  exports: [MeetingsService],
})
export class MeetingsModule {}
