import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { RunnerModule } from '../runner/runner.module';

@Module({
  imports: [RunnerModule],
  providers: [BotsService],
  controllers: [BotsController],
  exports: [BotsService],
})
export class BotsModule {}
