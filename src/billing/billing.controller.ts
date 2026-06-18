import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  Headers,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyTransactionDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;
}

type AuthenticatedRequest = Request & { user: { id: number } };

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyTransaction(
    @Body() dto: VerifyTransactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.billingService.verifyTransaction(req.user.id, dto.reference);
  }

  @Post('webhook')
  async handleWebhook(
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody = JSON.stringify(body);
    await this.billingService.handleWebhook(rawBody, signature);
    return { received: true };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getInvoiceHistory(@Req() req: AuthenticatedRequest) {
    return this.billingService.getInvoiceHistory(req.user.id);
  }
}

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly billingService: BillingService) {}

  @Get(':invoiceNumber.pdf')
  async getInvoicePdf(
    @Param('invoiceNumber') invoiceNumber: string,
    @Res() res: Response,
  ) {
    const pdfBuffer =
      await this.billingService.generateInvoicePdf(invoiceNumber);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
