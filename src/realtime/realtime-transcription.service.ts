import { Injectable } from '@nestjs/common';

import { DeepgramClient } from '@deepgram/sdk';

@Injectable()
export class RealtimeTranscriptionService {
  private readonly deepgram = new DeepgramClient({
    apiKey: process.env.DEEPGRAM_API_KEY || 'dummy-key',
  });

  async createLiveConnection() {
    const connection = await this.deepgram.listen.v1.connect({
      model: 'nova-2',

      language: 'en',

      smart_format: 'true',

      interim_results: 'true',

      punctuate: 'true',

      // Required by the generated v5 type; authentication is supplied by the client.
      Authorization: '',
    });

    connection.connect();
    await connection.waitForOpen();

    return connection;
  }
  async transcribeFile(buffer: Buffer) {
    const response = await this.deepgram.listen.v1.media.transcribeFile(
      buffer,
      {
        model: 'nova-2',
        smart_format: true,
      },
    );

    return response;
  }
}
