import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MacroDroidPayload {
  phone: string;
  amount: number;
  operator: 'mpesa' | 'emola' | 'mkesh';
  reference?: string;
  raw?: string;
}

@Injectable()
export class IngestService {
  constructor(private prisma: PrismaService) {}

  async ingest(apiKey: string | undefined, payload: MacroDroidPayload) {
    if (!apiKey) throw new UnauthorizedException('API key em falta');
    const key = await this.prisma.apiKey.findFirst({
      where: { key: apiKey, revoked: false },
      include: { tenant: true },
    });
    if (!key) throw new UnauthorizedException('API key inválida');
    if (!payload?.phone || !payload?.amount || !payload?.operator) {
      throw new BadRequestException('phone, amount e operator são obrigatórios');
    }

    // Duplicate guard: same tenant + reference within the last 10 minutes.
    if (payload.reference) {
      const dup = await this.prisma.transaction.findFirst({
        where: {
          tenantId: key.tenantId,
          reference: payload.reference,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });
      if (dup) {
        await this.touchKey(key.id);
        return this.prisma.transaction.create({
          data: {
            tenantId: key.tenantId,
            phoneNumber: payload.phone,
            amount: payload.amount,
            operator: payload.operator,
            status: 'duplicate',
            reference: payload.reference,
            rawMessage: payload.raw ?? null,
          },
        });
      }
    }

    // Try to auto-match a product (amount + operator or any operator).
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId: key.tenantId,
        amount: payload.amount,
        active: true,
        autoDetect: true,
        OR: [{ operator: payload.operator }, { operator: null }],
      },
    });

    const tx = await this.prisma.transaction.create({
      data: {
        tenantId: key.tenantId,
        productId: product?.id ?? null,
        phoneNumber: payload.phone,
        amount: payload.amount,
        operator: payload.operator,
        status: product ? 'delivered' : 'refused',
        reference: payload.reference ?? null,
        rawMessage: payload.raw ?? null,
      },
    });

    await this.touchKey(key.id);
    return tx;
  }

  private touchKey(id: string) {
    return this.prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }
}
