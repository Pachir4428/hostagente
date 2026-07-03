import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(tenantId: string) {
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
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription: { include: { plan: true } }, plan: true },
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
