import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

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
