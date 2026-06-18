import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Invoice } from './invoice.entity';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  private getPaystackSecretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || 'dummy-paystack-key';
  }

  async verifyTransaction(userId: number, reference: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if an invoice with this reference already exists to prevent double upgrades
    const existingInvoice = await this.invoiceRepo.findOne({
      where: { invoiceNumber: reference },
    });
    if (existingInvoice) {
      return { success: true, plan: existingInvoice.planId };
    }

    const paystackSecret = this.getPaystackSecretKey();
    const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new BadRequestException(
          'Failed to verify transaction with Paystack',
        );
      }

      const body = await response.json();
      if (!body.status || body.data.status !== 'success') {
        throw new BadRequestException('Transaction was not successful');
      }

      const data = body.data;
      const amountPaidKobo = data.amount; // In kobo

      // Map amount paid to plan and cycle (as back-up or primary if metadata is missing)
      let planId = 'personal';
      let billingCycle = 'monthly';
      let cycleDays = 30;

      // Read from metadata if present
      if (data.metadata && data.metadata.planId) {
        planId = data.metadata.planId;
        billingCycle = data.metadata.billingCycle || 'monthly';
      } else {
        // Fallback: Infer plan from amount
        // personal monthly: ₦9,999 = 999900 kobo
        // personal yearly: ₦107,989 = 10798900 kobo
        // teams monthly: ₦30,000 = 3000000 kobo
        // teams yearly: ₦306,000 = 30600000 kobo
        if (amountPaidKobo === 999900) {
          planId = 'personal';
          billingCycle = 'monthly';
        } else if (amountPaidKobo === 10798900) {
          planId = 'personal';
          billingCycle = 'yearly';
        } else if (amountPaidKobo === 3000000) {
          planId = 'teams';
          billingCycle = 'monthly';
        } else if (amountPaidKobo === 30600000) {
          planId = 'teams';
          billingCycle = 'yearly';
        }
      }

      cycleDays = billingCycle === 'yearly' ? 365 : 30;

      // Update User Plan info
      user.subscriptionPlan = planId;
      user.subscriptionStatus = 'active';
      user.subscriptionEndDate = new Date(
        Date.now() + cycleDays * 24 * 3600 * 1000,
      );
      user.paystackCustomerId = data.customer?.customer_code || null;
      user.paystackSubscriptionCode =
        data.subscription?.subscription_code || null;

      await this.userRepo.save(user);

      // Create Invoice Record
      const invoice = this.invoiceRepo.create({
        invoiceNumber: reference,
        amount: amountPaidKobo,
        currency: data.currency || 'NGN',
        planId,
        billingCycle,
        status: 'success',
        user,
      });

      await this.invoiceRepo.save(invoice);

      return { success: true, plan: planId };
    } catch (error: any) {
      console.error('Paystack verification error:', error);
      throw new BadRequestException(
        error.message || 'Error verifying transaction',
      );
    }
  }

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    if (!signature) {
      throw new BadRequestException('Missing signature header');
    }

    const paystackSecret = this.getPaystackSecretKey();
    const hash = crypto
      .createHmac('sha512', paystackSecret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    if (event === 'charge.success') {
      const reference = data.reference;
      const email = data.customer.email;

      const user = await this.userRepo.findOne({ where: { email } });
      if (user) {
        await this.verifyTransaction(user.id, reference);
      }
    } else if (event === 'subscription.disable') {
      const subCode = data.subscription_code;
      const user = await this.userRepo.findOne({
        where: { paystackSubscriptionCode: subCode },
      });
      if (user) {
        user.subscriptionStatus = 'canceled';
        await this.userRepo.save(user);
      }
    }
  }

  async getInvoiceHistory(userId: number): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async generateInvoicePdf(invoiceNumber: string): Promise<Buffer> {
    const invoice = await this.invoiceRepo.findOne({
      where: { invoiceNumber },
      relations: ['user'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const formattedAmount = (invoice.amount / 100).toLocaleString('en-NG', {
      style: 'currency',
      currency: invoice.currency,
    });

    const streamText = `
BT
/F1 20 Tf
50 760 Td
(MEETELLER INVOICE RECEIPT) Tj
/F1 12 Tf
0 -40 Td
(Invoice Number: ${invoice.invoiceNumber}) Tj
0 -20 Td
(Date: ${invoice.createdAt.toDateString()}) Tj
0 -20 Td
(Customer Email: ${invoice.user.email}) Tj
0 -30 Td
(Plan: ${invoice.planId.toUpperCase()} (${invoice.billingCycle.toUpperCase()})) Tj
0 -20 Td
(Amount Paid: ${formattedAmount}) Tj
0 -20 Td
(Payment Status: ${invoice.status.toUpperCase()}) Tj
0 -40 Td
(Thank you for subscribing to Meeteller!) Tj
ET
`.trim();

    const streamLength = Buffer.byteLength(streamText, 'utf-8');

    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 595 842] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${streamText}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000288 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${288 + 15 + streamLength + 20}
%%EOF`;

    return Buffer.from(pdfContent, 'utf-8');
  }
}
