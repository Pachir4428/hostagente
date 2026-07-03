import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async current(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } }, plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await this.prisma.transaction.count({
      where: { tenantId, createdAt: { gte: startOfMonth } },
    });

    const plan = tenant.subscription?.plan ?? tenant.plan ?? null;
    return {
      plan,
      status: tenant.subscription?.status ?? tenant.status,
      currentPeriodEnd: tenant.subscription?.currentPeriodEnd ?? null,
      usage: {
        transactions: usage,
        maxTransactions: plan?.maxTransactions ?? null,
      },
    };
  }

  plans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } });
  }

  invoices(tenantId: string) {
    return this.prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Change the tenant's plan. Records an invoice for the new plan's price.
   * Real payment capture (Stripe / manual M-Pesa reconciliation) is a later phase;
   * for now the invoice is created as "pending" for paid plans and the plan
   * takes effect immediately.
   */
  async changePlan(tenantId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plano inválido');

    const nextPeriod = new Date();
    nextPeriod.setMonth(nextPeriod.getMonth() + 1);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId,
        status: 'active',
        subscription: {
          upsert: {
            create: { planId, status: 'active', currentPeriodEnd: nextPeriod },
            update: { planId, status: 'active', currentPeriodEnd: nextPeriod },
          },
        },
      },
    });

    if (plan.priceMonthly > 0) {
      await this.prisma.invoice.create({
        data: { tenantId, amount: plan.priceMonthly, status: 'pending' },
      });
    }

    return this.current(tenantId);
  }
}
