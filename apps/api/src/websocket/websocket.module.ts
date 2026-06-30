import { Module } from '@nestjs/common';
import { BotGateway } from './bot.gateway';

@Module({
  providers: [BotGateway],
  exports: [BotGateway],
})
export class WebsocketModule {}
