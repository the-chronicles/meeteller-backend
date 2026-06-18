import { Injectable } from '@nestjs/common';

@Injectable()
export class AudioSessionManager {
  private audioStreams = new Map<
    number,
    {
      startedAt: Date;

      sourceType: string;

      chunkCount: number;
    }
  >();

  startStream(sessionId: number, sourceType: string) {
    this.audioStreams.set(sessionId, {
      startedAt: new Date(),

      sourceType,

      chunkCount: 0,
    });
  }

  incrementChunkCount(sessionId: number) {
    const stream = this.audioStreams.get(sessionId);

    if (!stream) return;

    stream.chunkCount += 1;
  }

  getStream(sessionId: number) {
    return this.audioStreams.get(sessionId);
  }

  stopStream(sessionId: number) {
    this.audioStreams.delete(sessionId);
  }
}
