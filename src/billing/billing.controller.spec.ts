import { Test, TestingModule } from '@nestjs/testing';
import { BillingController, InvoicesController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingControllers', () => {
  let billingController: BillingController;
  let invoicesController: InvoicesController;
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController, InvoicesController],
      providers: [
        {
          provide: BillingService,
          useValue: {
            verifyTransaction: jest.fn(),
            handleWebhook: jest.fn(),
            getInvoiceHistory: jest.fn(),
            generateInvoicePdf: jest.fn(),
          },
        },
      ],
    }).compile();

    billingController = module.get<BillingController>(BillingController);
    invoicesController = module.get<InvoicesController>(InvoicesController);
    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(billingController).toBeDefined();
    expect(invoicesController).toBeDefined();
  });

  describe('verifyTransaction', () => {
    it('should call billingService.verifyTransaction with correct parameters', async () => {
      const mockRequest = { user: { id: 42 } } as any;
      const mockDto = { reference: 'ref_789' };
      const mockResult = { success: true, plan: 'personal' };

      jest.spyOn(service, 'verifyTransaction').mockResolvedValue(mockResult);

      const response = await billingController.verifyTransaction(mockDto, mockRequest);

      expect(response).toEqual(mockResult);
      expect(service.verifyTransaction).toHaveBeenCalledWith(42, 'ref_789');
    });
  });

  describe('handleWebhook', () => {
    it('should pass signature and raw body string to service', async () => {
      const mockBody = { event: 'charge.success', data: { reference: 'ref_111' } };
      const signature = 'sha_sig_123';

      jest.spyOn(service, 'handleWebhook').mockResolvedValue(undefined);

      const response = await billingController.handleWebhook(mockBody, signature);

      expect(response).toEqual({ received: true });
      expect(service.handleWebhook).toHaveBeenCalledWith(JSON.stringify(mockBody), signature);
    });
  });

  describe('getInvoiceHistory', () => {
    it('should return service results using requester user id', async () => {
      const mockRequest = { user: { id: 100 } } as any;
      const mockInvoices = [{ id: 1 }, { id: 2 }];

      jest.spyOn(service, 'getInvoiceHistory').mockResolvedValue(mockInvoices as any);

      const response = await billingController.getInvoiceHistory(mockRequest);

      expect(response).toEqual(mockInvoices);
      expect(service.getInvoiceHistory).toHaveBeenCalledWith(100);
    });
  });

  describe('getInvoicePdf', () => {
    it('should set headers and stream the pdf buffer response', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock content');
      jest.spyOn(service, 'generateInvoicePdf').mockResolvedValue(mockPdfBuffer);

      const mockResponse = {
        set: jest.fn(),
        end: jest.fn(),
      } as any;

      await invoicesController.getInvoicePdf('INV_2026', mockResponse);

      expect(service.generateInvoicePdf).toHaveBeenCalledWith('INV_2026');
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="INV_2026.pdf"',
          'Content-Length': mockPdfBuffer.length,
        }),
      );
      expect(mockResponse.end).toHaveBeenCalledWith(mockPdfBuffer);
    });
  });
});
