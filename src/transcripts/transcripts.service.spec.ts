import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptsService } from './transcripts.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transcript } from './transcript.entity';
import { TranscriptSegment } from './transcript-segment.entity';
import { SearchService } from '../search/search.service';

describe('TranscriptsService', () => {
  let service: TranscriptsService;
  let transcriptRepo: any;
  let segmentRepo: any;
  let searchService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptsService,
        {
          provide: getRepositoryToken(Transcript),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TranscriptSegment),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: SearchService,
          useValue: {
            generateAndSaveEmbedding: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TranscriptsService>(TranscriptsService);
    transcriptRepo = module.get(getRepositoryToken(Transcript));
    segmentRepo = module.get(getRepositoryToken(TranscriptSegment));
    searchService = module.get(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addSegment', () => {
    it('should create and save a segment, and call generateAndSaveEmbedding if isFinal is true', async () => {
      const mockTranscript = { id: 1 };
      const mockSegment = { id: 42, text: 'Hello', isFinal: true };

      jest.spyOn(transcriptRepo, 'findOne').mockResolvedValue(mockTranscript as any);
      jest.spyOn(segmentRepo, 'create').mockReturnValue(mockSegment as any);
      jest.spyOn(segmentRepo, 'save').mockResolvedValue(mockSegment as any);

      const result = await service.addSegment(1, 'Hello', true);

      expect(result).toEqual(mockSegment);
      expect(transcriptRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(segmentRepo.create).toHaveBeenCalledWith({
        transcript: mockTranscript,
        text: 'Hello',
        isFinal: true,
      });
      expect(segmentRepo.save).toHaveBeenCalledWith(mockSegment);
      expect(searchService.generateAndSaveEmbedding).toHaveBeenCalledWith(42);
    });

    it('should create and save a segment, but NOT call generateAndSaveEmbedding if isFinal is false', async () => {
      const mockTranscript = { id: 1 };
      const mockSegment = { id: 43, text: 'Hello', isFinal: false };

      jest.spyOn(transcriptRepo, 'findOne').mockResolvedValue(mockTranscript as any);
      jest.spyOn(segmentRepo, 'create').mockReturnValue(mockSegment as any);
      jest.spyOn(segmentRepo, 'save').mockResolvedValue(mockSegment as any);

      const result = await service.addSegment(1, 'Hello', false);

      expect(result).toEqual(mockSegment);
      expect(searchService.generateAndSaveEmbedding).not.toHaveBeenCalled();
    });
  });
});
