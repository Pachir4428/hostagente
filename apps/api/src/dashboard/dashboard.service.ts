import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /** Sales insights: top packages, peak hours/days, recurring customers. */
  async insights(tenantId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const txs = await this.prisma.transaction.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { amount: true, phoneNumber: true, createdAt: true, status: true, product: { select: { description: true } } },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });
    const paid = txs.filter((t) => ['completed', 'success', 'delivered', 'paid'].includes(String(t.status)));
    const base = paid.length ? paid : txs; // fall back to all if statuses differ

    // Top packages by count + revenue.
    const pkg = new Map<string, { count: number; revenue: number }>();
    for (const t of base) {
      const key = t.product?.description || `${t.amount} MZN`;
      const cur = pkg.get(key) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += t.amount;
      pkg.set(key, cur);
    }
    const topPackages = [...pkg.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Peak hours (0-23) and weekdays (0=Dom).
    const byHour = Array.from({ length: 24 }, () => 0);
    const byDay = Array.from({ length: 7 }, () => 0);
    const customers = new Map<string, { count: number; revenue: number }>();
    let revenue = 0;
    for (const t of base) {
      const d = new Date(t.createdAt);
      byHour[d.getHours()] += 1;
      byDay[d.getDay()] += 1;
      revenue += t.amount;
      const c = customers.get(t.phoneNumber) || { count: 0, revenue: 0 };
      c.count += 1;
      c.revenue += t.amount;
      customers.set(t.phoneNumber, c);
    }
    const topCustomers = [...customers.entries()]
      .map(([phone, v]) => ({ phone, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSales: base.length,
      revenue,
      avgTicket: base.length ? Math.round(revenue / base.length) : 0,
      uniqueCustomers: customers.size,
      recurringCustomers: topCustomers.filter((c) => c.count > 1).length,
      topPackages,
      byHour,
      byDay,
      topCustomers,
    };
  }

  async summary(tenantId: string) {
    try {
      return await this.buildSummary(tenantId);
    } catch (err: any) {
      // Never 500 the Resumo — return a safe empty summary and log the cause.
      // eslint-disable-next-line no-console
      console.error('dashboard.summary error:', err?.message);
      const empty: { date: string; sales: number; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        empty.push({ date: d.toISOString().slice(0, 10), sales: 0, revenue: 0 });
      }
      return {
        salesToday: 0,
        revenueToday: 0,
        lastTransaction: null,
        series: empty,
        macrodroid: { online: false, lastSeen: null, minutesSince: null },
        plan: null,
        subscriptionStatus: null,
        degraded: true,
      };
    }
  }

  private async buildSummary(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [todayTx, lastTx, weekTx, tenant] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { tenantId, createdAt: { gte: startOfToday } },
      }),
      this.prisma.transaction.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.findMany({
        where: { tenantId, createdAt: { gte: sevenDaysAgo } },
        select: { amount: true, status: true, createdAt: true },
      }),
      // select only what we need so a schema drift (e.g. new columns not yet
      // pushed) can't break the whole Resumo.
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          status: true,
          plan: { select: { name: true } },
          subscription: { select: { status: true, plan: { select: { name: true } } } },
        },
      }),
    ]);

    const delivered = todayTx.filter((t) => t.status === 'delivered');
    const revenueToday = delivered.reduce((sum, t) => sum + t.amount, 0);

    // Build 7-day series (oldest → newest)
    const series: { date: string; sales: number; revenue: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sevenDaysAgo);
      day.setDate(sevenDaysAgo.getDate() + i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const dayTx = weekTx.filter(
        (t) => t.createdAt >= day && t.createdAt < next && t.status === 'delivered',
      );
      series.push({
        date: day.toISOString().slice(0, 10),
        sales: dayTx.length,
        revenue: dayTx.reduce((s, t) => s + t.amount, 0),
      });
    }

    // MacroDroid status: derived from the freshest api key activity / last tx.
    const lastSeen = lastTx?.createdAt ?? null;
    const minutesSince = lastSeen ? Math.floor((now.getTime() - lastSeen.getTime()) / 60000) : null;
    const macrodroidOnline = minutesSince !== null && minutesSince < 15;

    return {
      salesToday: delivered.length,
      revenueToday,
      lastTransaction: lastTx,
      series,
      macrodroid: { online: macrodroidOnline, lastSeen, minutesSince },
      plan: tenant?.subscription?.plan?.name ?? tenant?.plan?.name ?? null,
      subscriptionStatus: tenant?.subscription?.status ?? tenant?.status ?? null,
    };
  }
}
