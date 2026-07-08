import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { BotApiController } from './botapi.controller';
import { BotApiService } from './botapi.service';

@Module({
  imports: [ProductsModule],
  controllers: [BotApiController],
  providers: [BotApiService],
})
export class BotApiModule {}
