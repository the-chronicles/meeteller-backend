export type AudioSourceType =
  | 'google_meet'
  | 'zoom'
  | 'teams'
  | 'browser_capture'
  | 'uploaded_audio'
  | 'internal';

export interface AudioChunkPayload {
  sessionId: number;

  meetingId: number;

  sourceType: AudioSourceType;

  chunk: Buffer;

  timestamp: number;
}
