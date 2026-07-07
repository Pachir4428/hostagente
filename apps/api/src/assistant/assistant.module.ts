import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [SettingsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
