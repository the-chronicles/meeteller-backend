import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { SessionService } from './session/session.service';
import { MeetingsService } from '../meetings/meetings.service';
import { AudioSessionManager } from './audio-session.manager';
import { RealtimeTranscriptionService } from './realtime-transcription.service';
import { TranscriptsService } from '../transcripts/transcripts.service';
import { MeetingInsightsQueue } from '../ai/meeting-insights.queue';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            getSessionById: jest.fn(),
            updateSessionState: jest.fn(),
          },
        },
        {
          provide: MeetingsService,
          useValue: {
            getMeetingById: jest.fn(),
          },
        },
        {
          provide: AudioSessionManager,
          useValue: {
            startStream: jest.fn(),
            stopStream: jest.fn(),
            incrementChunkCount: jest.fn(),
          },
        },
        {
          provide: RealtimeTranscriptionService,
          useValue: {
            createLiveConnection: jest.fn(),
          },
        },
        {
          provide: TranscriptsService,
          useValue: {
            createTranscript: jest.fn(),
            addSegment: jest.fn(),
            completeTranscript: jest.fn(),
          },
        },
        {
          provide: MeetingInsightsQueue,
          useValue: {
            generateInsights: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
