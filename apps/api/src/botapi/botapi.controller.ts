import { Body, Controller, Delete, Get, Headers, Post } from '@nestjs/common';
import { BotApiService } from './botapi.service';

// Public API for tenant bots (WhatsApp/Baileys) — authenticated with the
// tenant's API key (x-api-key). Lets bot commands read/update the pacotes table.
@Controller('bot-api')
export class BotApiController {
  constructor(private service: BotApiService) {}

  @Get('products')
  list(@Headers('x-api-key') apiKey: string) {
    return this.service.list(apiKey);
  }

  @Post('products')
  upsert(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { amount: number; description: string; megabytes?: number | null; operator?: 'mpesa' | 'emola' | 'mkesh' | null; active?: boolean },
  ) {
    return this.service.upsert(apiKey, body);
  }

  @Delete('products')
  remove(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { id?: string; amount?: number; operator?: 'mpesa' | 'emola' | 'mkesh' | null },
  ) {
    return this.service.remove(apiKey, body);
  }
}
