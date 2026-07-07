import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { MailModule } from '../mail/mail.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [SettingsModule, MailModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
