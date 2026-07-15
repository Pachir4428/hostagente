import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  /** The tenant's own referral code + who they referred. */
  async mine(tenantId: string) {
    let tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    // Mint a code if this tenant doesn't have one yet (older accounts).
    if (tenant && !tenant.referralCode) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      tenant = await this.prisma.tenant.update({ where: { id: tenantId }, data: { referralCode: code } });
    }
    const referred = await this.prisma.tenant.findMany({
      where: { referredById: tenantId },
      select: { name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const active = referred.filter((r) => r.status === 'active').length;
    return {
      code: tenant?.referralCode || '',
      count: referred.length,
      active,
      referred,
    };
  }

  /** Ranking of top referrers (super admin). */
  async ranking() {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true, referrals: { select: { id: true, status: true } } },
    });
    return tenants
      .map((t) => ({
        name: t.name,
        total: t.referrals.length,
        active: t.referrals.filter((r) => r.status === 'active').length,
      }))
      .filter((t) => t.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }
}
