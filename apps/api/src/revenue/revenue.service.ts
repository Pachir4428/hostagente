import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RevenueService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [paidAll, paidMonth, pending, activeSubs, invoices, tenants, plans] = await Promise.all([
      this.prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
      this.prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'paid', createdAt: { gte: startOfMonth } } }),
      this.prisma.invoice.aggregate({ _sum: { amount: true }, _count: true, where: { status: { in: ['pending', 'awaiting'] } } }),
      this.prisma.subscription.findMany({ where: { status: 'active' }, include: { plan: true } }),
      this.prisma.invoice.findMany({ where: { status: 'paid' }, select: { tenantId: true, amount: true } }),
      this.prisma.tenant.findMany({ select: { id: true, name: true } }),
      this.prisma.plan.findMany({ select: { id: true, name: true } }),
    ]);

    // MRR + revenue by plan (from active subscriptions).
    let mrr = 0;
    const byPlan = new Map<string, { name: string; count: number; mrr: number }>();
    for (const s of activeSubs) {
      const price = s.plan?.priceMonthly || 0;
      mrr += price;
      const key = s.planId;
      const cur = byPlan.get(key) || { name: s.plan?.name || '—', count: 0, mrr: 0 };
      cur.count += 1;
      cur.mrr += price;
      byPlan.set(key, cur);
    }

    // Top tenants by total paid.
    const tName = new Map(tenants.map((t) => [t.id, t.name]));
    const byTenant = new Map<string, number>();
    for (const inv of invoices) byTenant.set(inv.tenantId, (byTenant.get(inv.tenantId) || 0) + inv.amount);
    const topTenants = [...byTenant.entries()]
      .map(([id, total]) => ({ tenant: tName.get(id) || id, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      mrr,
      revenueTotal: paidAll._sum.amount || 0,
      revenueMonth: paidMonth._sum.amount || 0,
      pendingAmount: pending._sum.amount || 0,
      pendingCount: pending._count || 0,
      activeSubscriptions: activeSubs.length,
      byPlan: [...byPlan.values()].sort((a, b) => b.mrr - a.mrr),
      topTenants,
    };
  }
}
