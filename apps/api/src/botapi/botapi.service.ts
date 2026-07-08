import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Lets a manual WhatsApp bot (running the tenant's own project) manage the
// pacotes table via commands, authenticated with the tenant's API key.
@Injectable()
export class BotApiService {
  private redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

  constructor(
    private prisma: PrismaService,
    private products: ProductsService,
  ) {
    this.redis.on('error', () => {});
  }

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

  /**
   * The bot reports the WhatsApp groups it belongs to (name, description,
   * admin numbers, active services). Verified to belong to the tenant, then
   * cached in Redis for the panel to display.
   */
  async reportGroups(
    apiKey: string | undefined,
    botId: string,
    groups: { name?: string; description?: string; admins?: string[]; services?: string[]; participants?: number }[],
  ) {
    const tenantId = await this.tenantFromKey(apiKey);
    const bot = await this.prisma.bot.findFirst({ where: { id: botId, tenantId } });
    if (!bot) throw new UnauthorizedException('Bot não pertence a este tenant');
    const clean = (Array.isArray(groups) ? groups : []).slice(0, 200).map((g) => ({
      name: String(g.name || 'Grupo'),
      description: g.description ? String(g.description).slice(0, 500) : '',
      admins: Array.isArray(g.admins) ? g.admins.slice(0, 50).map(String) : [],
      services: Array.isArray(g.services) ? g.services.slice(0, 50).map(String) : [],
      participants: typeof g.participants === 'number' ? g.participants : undefined,
    }));
    try {
      await this.redis.set(`bot:${botId}:groups`, JSON.stringify(clean), 'EX', 60 * 60 * 24 * 7);
    } catch {
      /* ignore */
    }
    return { success: true, count: clean.length };
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
