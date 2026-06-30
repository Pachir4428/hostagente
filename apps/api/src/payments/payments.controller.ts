import { Controller, Post, Body, Headers, RawBodyRequest, Req, Logger, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private paymentsService: PaymentsService) {}

  @Post('webhooks/mpesa')
  @HttpCode(200)
  async mpesaWebhook(
    @Body() body: any,
    @Headers('x-mpesa-signature') signature: string,
  ) {
    const secret = process.env.MPESA_WEBHOOK_SECRET || '';
    return this.paymentsService.processMpesaWebhook(body);
  }

  @Post('webhooks/emola')
  @HttpCode(200)
  async emolaWebhook(
    @Body() body: any,
    @Headers('x-emola-signature') signature: string,
  ) {
    return this.paymentsService.processEmolaWebhook(body);
  }

  @Post('webhooks/mkesh')
  @HttpCode(200)
  async mkeshWebhook(
    @Body() body: any,
    @Headers('x-mkesh-signature') signature: string,
  ) {
    return this.paymentsService.processMkeshWebhook(body);
  }
}
