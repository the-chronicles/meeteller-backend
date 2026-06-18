import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: {
            semanticSearch: jest.fn(),
            aiChat: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('semanticSearch', () => {
    it('should call searchService.semanticSearch with correct arguments', async () => {
      const mockRequest = { user: { id: 42 } } as any;
      const mockQuery = {
        query: 'test query',
        meetingId: '10',
        workspaceId: '20',
        limit: '5',
      };
      const mockResult = [{ id: 1, text: 'segment text' }];
      jest.spyOn(service, 'semanticSearch').mockResolvedValue(mockResult as any);

      const response = await controller.semanticSearch(mockQuery, mockRequest);

      expect(response).toEqual(mockResult);
      expect(service.semanticSearch).toHaveBeenCalledWith(42, 'test query', {
        meetingId: 10,
        workspaceId: 20,
        limit: 5,
      });
    });

    it('should handle missing optional query parameters', async () => {
      const mockRequest = { user: { id: 42 } } as any;
      const mockQuery = {
        query: 'test query',
      };
      const mockResult = [{ id: 1, text: 'segment text' }];
      jest.spyOn(service, 'semanticSearch').mockResolvedValue(mockResult as any);

      const response = await controller.semanticSearch(mockQuery, mockRequest);

      expect(response).toEqual(mockResult);
      expect(service.semanticSearch).toHaveBeenCalledWith(42, 'test query', {
        meetingId: undefined,
        workspaceId: undefined,
        limit: undefined,
      });
    });
  });

  describe('chat', () => {
    it('should call searchService.aiChat with correct arguments', async () => {
      const mockRequest = { user: { id: 42 } } as any;
      const mockBody = { question: 'What was said?' };
      const mockReply = 'Mock LLM reply';
      jest.spyOn(service, 'aiChat').mockResolvedValue(mockReply);

      const response = await controller.chat('99', mockBody, mockRequest);

      expect(response).toEqual(mockReply);
      expect(service.aiChat).toHaveBeenCalledWith(42, 'What was said?', 99);
    });
  });
});
