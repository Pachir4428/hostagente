import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        subscription: { include: { plan: true } },
        _count: { select: { transactions: true, users: true } },
      },
    });

    // Attach revenue (sum of delivered transactions) per tenant.
    const revenues = await this.prisma.transaction.groupBy({
      by: ['tenantId'],
      where: { status: 'delivered' },
      _sum: { amount: true },
    });
    const revMap = new Map(revenues.map((r) => [r.tenantId, r._sum.amount ?? 0]));

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      plan: t.subscription?.plan?.name ?? t.plan?.name ?? null,
      users: t._count.users,
      transactions: t._count.transactions,
      revenue: revMap.get(t.id) ?? 0,
      createdAt: t.createdAt,
    }));
  }

  async detail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: { include: { plan: true } },
        users: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
        _count: { select: { transactions: true, products: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const recent = await this.prisma.transaction.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return { ...tenant, recentTransactions: recent };
  }

  async setStatus(id: string, status: 'active' | 'suspended') {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    const updated = await this.prisma.tenant.update({ where: { id }, data: { status } });
    this.audit.log(null, 'SUPER_ADMIN', `tenant.${status}`, { tenantId: id, name: tenant.name });
    return updated;
  }
}
