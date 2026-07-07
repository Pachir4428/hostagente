import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [MailModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
