import { Module } from '@nestjs/common';
import { BroadcastController, AnnouncementsController } from './broadcast.controller';
import { BroadcastService } from './broadcast.service';

@Module({
  controllers: [BroadcastController, AnnouncementsController],
  providers: [BroadcastService],
})
export class BroadcastModule {}
