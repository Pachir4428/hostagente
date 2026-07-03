import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

function newApiKey(): string {
  return 'hka_' + randomBytes(24).toString('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId, revoked: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async regenerate(tenantId: string) {
    // Revoke existing keys and issue a fresh one.
    await this.prisma.apiKey.updateMany({
      where: { tenantId, revoked: false },
      data: { revoked: true },
    });
    return this.prisma.apiKey.create({
      data: { tenantId, key: newApiKey() },
    });
  }

  async account(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: { include: { plan: true } },
        plan: true,
        apiKeys: { where: { revoked: false }, orderBy: { createdAt: 'desc' } },
      },
    });
    return tenant;
  }

  updateAccount(
    tenantId: string,
    data: { name?: string; contact?: string; receivingNumber?: string },
  ) {
    return this.prisma.tenant.update({ where: { id: tenantId }, data });
  }
}
