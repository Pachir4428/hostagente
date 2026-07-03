import { Module } from '@nestjs/common';
import { SupportController, AdminSupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
