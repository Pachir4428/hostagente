import { Injectable } from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RUNNER_URL = process.env.RUNNER_INTERNAL_URL || 'http://bot-runner:4001';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
const ACTIVE = ['connected', 'starting'];

@Injectable()
export class PlatformService {
  private redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  constructor(private prisma: PrismaService) {
    this.redis.on('error', () => {});
  }

  /** System health: services status, active bots, resource use. */
  async health() {
    let dbOk = false;
    let redisOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    try {
      redisOk = (await this.redis.ping()) === 'PONG';
    } catch {
      redisOk = false;
    }
    const [tenants, users, botsTotal, botsActive] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.bot.count(),
      this.prisma.bot.count({ where: { status: { in: ACTIVE as any } } }),
    ]);
    const mem = process.memoryUsage();
    return {
      services: {
        api: true,
        database: dbOk,
        redis: redisOk,
      },
      counts: { tenants, users, botsTotal, botsActive },
      memory: { rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576) },
      uptimeSec: Math.round(process.uptime()),
    };
  }

  /** Growth metrics: registrations/day, conversion, churn. */
  async growth() {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);
    const tenants = await this.prisma.tenant.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const byStatus = await this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } });
    const sc: Record<string, number> = {};
    for (const s of byStatus) sc[s.status] = s._count._all;
    const total = byStatus.reduce((s, r) => s + r._count._all, 0);

    // Series of new registrations per day (last 30 days).
    const series: { date: string; count: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      series.push({
        date: d.toISOString().slice(0, 10),
        count: tenants.filter((t) => t.createdAt >= d && t.createdAt < next).length,
      });
    }
    const paying = (sc['active'] ?? 0) + (sc['past_due'] ?? 0);
    return {
      total,
      trial: sc['trial'] ?? 0,
      active: sc['active'] ?? 0,
      suspended: sc['suspended'] ?? 0,
      cancelled: sc['cancelled'] ?? 0,
      conversionPct: total > 0 ? Math.round((paying / total) * 100) : 0,
      churnPct: total > 0 ? Math.round(((sc['cancelled'] ?? 0) / total) * 100) : 0,
      newLast30: tenants.length,
      series,
    };
  }

  /** All bots across all tenants (for global management). */
  async bots() {
    const bots = await this.prisma.bot.findMany({ orderBy: { updatedAt: 'desc' }, take: 500 });
    const tenantIds = [...new Set(bots.map((b) => b.tenantId))];
    const tenants = await this.prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
    const tName = new Map(tenants.map((t) => [t.id, t.name]));
    return bots.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      status: b.status,
      tenant: tName.get(b.tenantId) || b.tenantId,
      updatedAt: b.updatedAt,
    }));
  }

  async botAction(id: string, action: 'stop' | 'restart') {
    try {
      await axios.post(
        `${RUNNER_URL}/bots/${action}`,
        { botId: id },
        { headers: { 'x-internal-secret': INTERNAL_SECRET }, timeout: 15000 },
      );
    } catch (e: any) {
      return { success: false, message: e?.message || 'runner indisponível' };
    }
    await this.prisma.bot.update({ where: { id }, data: { status: action === 'stop' ? 'stopped' : 'starting' } }).catch(() => null);
    return { success: true };
  }

  async summary() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [byStatus, subs, new7, new30, totalTx] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.subscription.findMany({
        where: { status: { in: ['active', 'past_due'] } },
        include: { plan: true },
      }),
      this.prisma.tenant.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.transaction.count(),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of byStatus) statusCounts[s.status] = s._count._all;

    // MRR = sum of active subscriptions' monthly price.
    const mrr = subs.reduce((sum, s) => sum + (s.plan?.priceMonthly ?? 0), 0);

    const totalTenants = byStatus.reduce((s, r) => s + r._count._all, 0);
    const cancelled = statusCounts['cancelled'] ?? 0;
    const churnRate = totalTenants > 0 ? cancelled / totalTenants : 0;

    return {
      mrr,
      tenants: {
        total: totalTenants,
        active: statusCounts['active'] ?? 0,
        trial: statusCounts['trial'] ?? 0,
        past_due: statusCounts['past_due'] ?? 0,
        suspended: statusCounts['suspended'] ?? 0,
        cancelled,
      },
      newTenants: { last7: new7, last30: new30 },
      churnRate,
      totalTransactions: totalTx,
    };
  }
}
