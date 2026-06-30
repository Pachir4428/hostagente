import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService) {}

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) return true;
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return hmac === signature;
  }

  async processMpesaWebhook(data: any) {
    this.logger.log('Processing M-Pesa webhook', data);
    const payment = await this.prisma.payment.create({
      data: {
        userId: data.userId || 'unknown',
        amount: parseFloat(data.amount || '0'),
        currency: 'MZN',
        status: data.status === 'success' ? 'completed' : 'pending',
        provider: 'mpesa',
        providerRef: data.transactionId,
        metadata: data,
      },
    });
    return payment;
  }

  async processEmolaWebhook(data: any) {
    this.logger.log('Processing Emola webhook', data);
    const payment = await this.prisma.payment.create({
      data: {
        userId: data.userId || 'unknown',
        amount: parseFloat(data.amount || '0'),
        currency: 'MZN',
        status: data.status === 'success' ? 'completed' : 'pending',
        provider: 'emola',
        providerRef: data.reference,
        metadata: data,
      },
    });
    return payment;
  }

  async processMkeshWebhook(data: any) {
    this.logger.log('Processing Mkesh webhook', data);
    const payment = await this.prisma.payment.create({
      data: {
        userId: data.userId || 'unknown',
        amount: parseFloat(data.amount || '0'),
        currency: 'MZN',
        status: data.status === 'success' ? 'completed' : 'pending',
        provider: 'mkesh',
        providerRef: data.ref,
        metadata: data,
      },
    });
    return payment;
  }
}
