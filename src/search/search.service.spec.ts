import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { TranscriptSegment } from '../transcripts/transcript-segment.entity';
import { Meeting } from '../meetings/meeting.entity';
import { WorkspaceMember } from '../workspaces/workspace-member.entity';
import { DataSource } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }],
        }),
      },
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Answer from mock LLM.' } }],
          }),
        },
      },
    };
  });
});

describe('SearchService', () => {
  let service: SearchService;
  let segmentRepo: any;
  let meetingRepo: any;
  let memberRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(TranscriptSegment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Meeting),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    segmentRepo = module.get(getRepositoryToken(TranscriptSegment));
    meetingRepo = module.get(getRepositoryToken(Meeting));
    memberRepo = module.get(getRepositoryToken(WorkspaceMember));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEmbedding', () => {
    it('should call openai.embeddings.create and return float array', async () => {
      const embedding = await service.generateEmbedding('test text');
      expect(embedding).toEqual(Array(1536).fill(0.1));
    });
  });

  describe('generateAndSaveEmbedding', () => {
    it('should do nothing if segment not found', async () => {
      jest.spyOn(segmentRepo, 'findOne').mockResolvedValue(null);
      await service.generateAndSaveEmbedding(1);
      expect(segmentRepo.save).not.toHaveBeenCalled();
    });

    it('should generate embedding and save segment', async () => {
      const mockSegment = { id: 1, text: 'hi', embedding: null };
      jest.spyOn(segmentRepo, 'findOne').mockResolvedValue(mockSegment as any);
      jest.spyOn(segmentRepo, 'save').mockResolvedValue(mockSegment as any);

      await service.generateAndSaveEmbedding(1);

      expect(segmentRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockSegment.embedding).toEqual(Array(1536).fill(0.1));
      expect(segmentRepo.save).toHaveBeenCalledWith(mockSegment);
    });
  });

  describe('semanticSearch', () => {
    it('should perform vector similarity search and map results', async () => {
      const mockDbResults = [
        {
          id: 10,
          text: 'Hello world',
          speaker: 'Speaker A',
          startTime: 0,
          endTime: 5,
          meetingId: 20,
          meetingTitle: 'Daily Standup',
          distance: 0.2,
        },
      ];

      jest.spyOn(dataSource, 'query').mockResolvedValue(mockDbResults);

      const results = await service.semanticSearch(1, 'search query', {
        meetingId: 20,
        limit: 3,
      });

      expect(dataSource.query).toHaveBeenCalled();
      expect(results).toEqual([
        {
          id: 10,
          text: 'Hello world',
          speaker: 'Speaker A',
          startTime: 0,
          endTime: 5,
          meeting: {
            id: 20,
            title: 'Daily Standup',
          },
          similarity: 0.8,
        },
      ]);
    });
  });

  describe('aiChat', () => {
    it('should throw NotFoundException if meeting does not exist', async () => {
      jest.spyOn(meetingRepo, 'findOne').mockResolvedValue(null);

      await expect(service.aiChat(1, 'What was said?', 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user has no access', async () => {
      const mockMeeting = {
        id: 99,
        owner: { id: 2 },
        workspace: { id: 5 },
      };

      jest.spyOn(meetingRepo, 'findOne').mockResolvedValue(mockMeeting as any);
      jest.spyOn(memberRepo, 'findOne').mockResolvedValue(null);

      await expect(service.aiChat(1, 'What was said?', 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should chat successfully if user is owner', async () => {
      const mockMeeting = {
        id: 99,
        owner: { id: 1 },
        workspace: null,
      };

      const mockDbResults = [
        {
          id: 10,
          text: 'We discussed deployment.',
          speaker: 'Speaker A',
          startTime: 0,
          endTime: 5,
          meetingId: 99,
          meetingTitle: 'Sync',
          distance: 0.1,
        },
      ];

      jest.spyOn(meetingRepo, 'findOne').mockResolvedValue(mockMeeting as any);
      jest.spyOn(dataSource, 'query').mockResolvedValue(mockDbResults);

      const reply = await service.aiChat(1, 'What was said?', 99);

      expect(reply).toBe('Answer from mock LLM.');
    });

    it('should chat successfully if user is workspace member', async () => {
      const mockMeeting = {
        id: 99,
        owner: { id: 2 },
        workspace: { id: 5 },
      };

      const mockMembership = { id: 100 };

      const mockDbResults = [
        {
          id: 10,
          text: 'We discussed deployment.',
          speaker: 'Speaker A',
          startTime: 0,
          endTime: 5,
          meetingId: 99,
          meetingTitle: 'Sync',
          distance: 0.1,
        },
      ];

      jest.spyOn(meetingRepo, 'findOne').mockResolvedValue(mockMeeting as any);
      jest.spyOn(memberRepo, 'findOne').mockResolvedValue(mockMembership as any);
      jest.spyOn(dataSource, 'query').mockResolvedValue(mockDbResults);

      const reply = await service.aiChat(1, 'What was said?', 99);

      expect(reply).toBe('Answer from mock LLM.');
    });
  });
});
