import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { IngestService, MacroDroidPayload } from './ingest.service';

@Controller('ingest')
export class IngestController {
  constructor(private service: IngestService) {}

  /**
   * MacroDroid posts here when it detects an M-Pesa / e-Mola / mKesh SMS.
   * Authenticated with the tenant's API key via the `x-api-key` header.
   */
  @Post('macrodroid')
  @HttpCode(200)
  ingest(@Headers('x-api-key') apiKey: string, @Body() payload: MacroDroidPayload) {
    return this.service.ingest(apiKey, payload);
  }
}
