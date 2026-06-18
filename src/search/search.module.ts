import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { TranscriptSegment } from '../transcripts/transcript-segment.entity';
import { Meeting } from '../meetings/meeting.entity';
import { WorkspaceMember } from '../workspaces/workspace-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TranscriptSegment, Meeting, WorkspaceMember]),
  ],
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
