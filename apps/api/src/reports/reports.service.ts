import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [tenants, deliveredAgg, totalTx, activeSubs] = await Promise.all([
      this.prisma.tenant.findMany({ select: { createdAt: true } }),
      this.prisma.transaction.aggregate({ where: { status: 'delivered' }, _sum: { amount: true } }),
      this.prisma.transaction.count(),
      this.prisma.subscription.findMany({
        where: { status: { in: ['active', 'past_due'] } },
        include: { plan: true },
      }),
    ]);

    // Account growth per month (last 6 months).
    const growth: { month: string; count: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const start = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const count = tenants.filter((t) => t.createdAt >= start && t.createdAt < end).length;
      growth.push({ month: start.toISOString().slice(0, 7), count });
    }

    const totalRevenue = deliveredAgg._sum.amount ?? 0;
    const totalTenants = tenants.length;
    const mrr = activeSubs.reduce((s, x) => s + (x.plan?.priceMonthly ?? 0), 0);
    // Simple avg LTV proxy: total processed revenue / number of tenants.
    const avgLtv = totalTenants > 0 ? totalRevenue / totalTenants : 0;

    return {
      growth,
      totalTenants,
      totalRevenueProcessed: totalRevenue,
      totalTransactions: totalTx,
      mrr,
      avgLtv,
    };
  }
}
