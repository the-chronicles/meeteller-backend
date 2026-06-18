import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: {
            getGoogleAuthUrl: jest.fn(),
            getZoomAuthUrl: jest.fn(),
            handleGoogleCallback: jest.fn(),
            handleZoomCallback: jest.fn(),
            syncGoogleCalendar: jest.fn(),
            createGoogleMeet: jest.fn(),
            createZoomMeeting: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
