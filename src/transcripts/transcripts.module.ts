import { Module } from '@nestjs/common';
import { TranscriptsService } from './transcripts.service';
import { TranscriptSegment } from './transcript-segment.entity';
import { Transcript } from './transcript.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transcript, TranscriptSegment]),
    SearchModule,
  ],

  providers: [TranscriptsService],

  exports: [TranscriptsService],
})
export class TranscriptsModule {}
