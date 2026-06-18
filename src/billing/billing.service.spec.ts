import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { User } from '../users/user.entity';
import { Invoice } from './invoice.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('BillingService', () => {
  let service: BillingService;
  let userRepo: any;
  let invoiceRepo: any;
  let originalFetch: any;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    userRepo = module.get(getRepositoryToken(User));
    invoiceRepo = module.get(getRepositoryToken(Invoice));
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyTransaction', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      await expect(service.verifyTransaction(1, 'ref_123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing plan if reference is already verified', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      const mockInvoice = { id: 10, planId: 'teams', invoiceNumber: 'ref_123' };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as any);

      const result = await service.verifyTransaction(1, 'ref_123');
      expect(result).toEqual({ success: true, plan: 'teams' });
      expect(invoiceRepo.findOne).toHaveBeenCalledWith({
        where: { invoiceNumber: 'ref_123' },
      });
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should verify transaction and upgrade user to personal monthly plan', async () => {
      const mockUser = { id: 1, email: 'test@example.com', subscriptionPlan: 'basic' };
      const mockPaystackResponse = {
        status: true,
        data: {
          status: 'success',
          amount: 999900,
          currency: 'NGN',
          customer: { customer_code: 'CUST_123' },
          subscription: { subscription_code: 'SUB_123' },
        },
      };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(invoiceRepo, 'create').mockReturnValue({ id: 100 } as any);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue({ id: 100 } as any);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPaystackResponse),
      });

      const result = await service.verifyTransaction(1, 'ref_123');

      expect(result).toEqual({ success: true, plan: 'personal' });
      expect(mockUser.subscriptionPlan).toBe('personal');
      expect(mockUser.subscriptionStatus).toBe('active');
      expect(userRepo.save).toHaveBeenCalledWith(mockUser);
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'ref_123',
          amount: 999900,
          planId: 'personal',
          billingCycle: 'monthly',
          status: 'success',
        }),
      );
      expect(invoiceRepo.save).toHaveBeenCalled();
    });

    it('should verify transaction and upgrade user to teams yearly plan', async () => {
      const mockUser = { id: 1, email: 'test@example.com', subscriptionPlan: 'basic' };
      const mockPaystackResponse = {
        status: true,
        data: {
          status: 'success',
          amount: 30600000,
          currency: 'NGN',
          customer: { customer_code: 'CUST_123' },
          subscription: { subscription_code: 'SUB_123' },
        },
      };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(invoiceRepo, 'create').mockReturnValue({ id: 100 } as any);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue({ id: 100 } as any);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPaystackResponse),
      });

      const result = await service.verifyTransaction(1, 'ref_123');

      expect(result).toEqual({ success: true, plan: 'teams' });
      expect(mockUser.subscriptionPlan).toBe('teams');
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'ref_123',
          amount: 30600000,
          planId: 'teams',
          billingCycle: 'yearly',
          status: 'success',
        }),
      );
    });

    it('should throw BadRequestException if Paystack verification fails', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(service.verifyTransaction(1, 'ref_123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleWebhook', () => {
    it('should throw BadRequestException if signature signature is invalid', async () => {
      await expect(service.handleWebhook('{"test":"data"}', 'wrong_sig')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process charge.success and update user plan', async () => {
      const secret = 'dummy-paystack-key';
      const body = {
        event: 'charge.success',
        data: {
          reference: 'ref_123',
          customer: { email: 'test@example.com' },
        },
      };
      const rawBody = JSON.stringify(body);
      const signature = crypto
        .createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

      const mockUser = { id: 42, email: 'test@example.com' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(service, 'verifyTransaction').mockResolvedValue({ success: true });

      await service.handleWebhook(rawBody, signature);

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(service.verifyTransaction).toHaveBeenCalledWith(42, 'ref_123');
    });

    it('should process subscription.disable and cancel subscription status', async () => {
      const secret = 'dummy-paystack-key';
      const body = {
        event: 'subscription.disable',
        data: {
          subscription_code: 'SUB_123',
        },
      };
      const rawBody = JSON.stringify(body);
      const signature = crypto
        .createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

      const mockUser = { id: 42, subscriptionStatus: 'active', paystackSubscriptionCode: 'SUB_123' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepo, 'save').mockResolvedValue(mockUser as any);

      await service.handleWebhook(rawBody, signature);

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { paystackSubscriptionCode: 'SUB_123' },
      });
      expect(mockUser.subscriptionStatus).toBe('canceled');
      expect(userRepo.save).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getInvoiceHistory', () => {
    it('should return invoice list sorted by date', async () => {
      const mockInvoices = [{ id: 1 }, { id: 2 }];
      jest.spyOn(invoiceRepo, 'find').mockResolvedValue(mockInvoices as any);

      const result = await service.getInvoiceHistory(10);
      expect(result).toBe(mockInvoices);
      expect(invoiceRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 10 } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('generateInvoicePdf', () => {
    it('should throw NotFoundException if invoice not found', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(null);
      await expect(service.generateInvoicePdf('INV_123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return a valid PDF Buffer', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV_123',
        amount: 999900,
        currency: 'NGN',
        planId: 'personal',
        billingCycle: 'monthly',
        status: 'success',
        user: { email: 'test@example.com' },
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as any);

      const buffer = await service.generateInvoicePdf('INV_123');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString('utf-8')).toContain('%PDF-1.4');
      expect(buffer.toString('utf-8')).toContain('INV_123');
    });
  });
});
