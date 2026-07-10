import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

@Module({
  imports: [NotificationsModule, MailModule],
  controllers: [BotsController],
  providers: [BotsService],
})
export class BotsModule {}
