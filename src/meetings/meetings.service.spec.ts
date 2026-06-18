import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsService } from './meetings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Meeting } from './meeting.entity';
import { MeetingInsight } from '../ai/meeting-insight.entity';
import { TranscriptsService } from '../transcripts/transcripts.service';
import { WorkspaceMember } from '../workspaces/workspace-member.entity';
import { User } from '../users/user.entity';

describe('MeetingsService', () => {
  let service: MeetingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        {
          provide: getRepositoryToken(Meeting),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MeetingInsight),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: TranscriptsService,
          useValue: {
            getTranscriptByMeetingId: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
