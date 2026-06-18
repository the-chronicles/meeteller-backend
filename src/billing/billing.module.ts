import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController, InvoicesController } from './billing.controller';
import { User } from '../users/user.entity';
import { Invoice } from './invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Invoice])],
  providers: [BillingService],
  controllers: [BillingController, InvoicesController],
  exports: [BillingService],
})
export class BillingModule {}
