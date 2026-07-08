import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

// Lets a manual WhatsApp bot (running the tenant's own project) manage the
// pacotes table via commands, authenticated with the tenant's API key.
@Injectable()
export class BotApiService {
  constructor(
    private prisma: PrismaService,
    private products: ProductsService,
  ) {}

  private async tenantFromKey(apiKey?: string): Promise<string> {
    if (!apiKey) throw new UnauthorizedException('API key em falta');
    const key = await this.prisma.apiKey.findFirst({ where: { key: apiKey, revoked: false } });
    if (!key) throw new UnauthorizedException('API key inválida');
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => null);
    return key.tenantId;
  }

  async list(apiKey?: string) {
    const tenantId = await this.tenantFromKey(apiKey);
    return this.products.list(tenantId);
  }

  /**
   * Upsert a pacote by (amount, operator). If one exists it is updated,
   * otherwise created. Intended to be called from WhatsApp bot commands.
   */
  async upsert(
    apiKey: string | undefined,
    data: { amount: number; description: string; megabytes?: number | null; operator?: 'mpesa' | 'emola' | 'mkesh' | null; active?: boolean },
  ) {
    const tenantId = await this.tenantFromKey(apiKey);
    if (!data?.amount || !data?.description) {
      throw new BadRequestException('amount e description são obrigatórios');
    }
    const existing = await this.prisma.product.findFirst({
      where: { tenantId, amount: data.amount, operator: data.operator ?? null },
    });
    if (existing) {
      return this.products.update(tenantId, existing.id, data);
    }
    return this.products.create(tenantId, data);
  }

  async remove(apiKey: string | undefined, body: { id?: string; amount?: number; operator?: 'mpesa' | 'emola' | 'mkesh' | null }) {
    const tenantId = await this.tenantFromKey(apiKey);
    let id = body.id;
    if (!id && body.amount) {
      const existing = await this.prisma.product.findFirst({
        where: { tenantId, amount: body.amount, operator: body.operator ?? null },
      });
      id = existing?.id;
    }
    if (!id) throw new BadRequestException('Indica o id ou o amount do pacote');
    return this.products.remove(tenantId, id);
  }
}
