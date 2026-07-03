import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface PlanInput {
  name: string;
  priceMonthly: number;
  maxTransactions: number;
  maxUsers: number;
  features?: string[];
  isActive?: boolean;
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ---- Plans ----
  listPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async createPlan(actor: string, data: PlanInput) {
    const plan = await this.prisma.plan.create({
      data: {
        name: data.name,
        priceMonthly: data.priceMonthly,
        maxTransactions: data.maxTransactions,
        maxUsers: data.maxUsers,
        features: data.features ?? [],
        isActive: data.isActive ?? true,
      },
    });
    this.audit.log(actor, 'SUPER_ADMIN', 'plan.create', { planId: plan.id, name: plan.name });
    return plan;
  }

  async updatePlan(actor: string, id: string, data: Partial<PlanInput>) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plano não encontrado');
    const plan = await this.prisma.plan.update({ where: { id }, data });
    this.audit.log(actor, 'SUPER_ADMIN', 'plan.update', { planId: id });
    return plan;
  }

  // ---- Coupons ----
  listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCoupon(actor: string, data: { code: string; discountPct: number; expiresAt?: string }) {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountPct: data.discountPct,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    this.audit.log(actor, 'SUPER_ADMIN', 'coupon.create', { code: coupon.code });
    return coupon;
  }

  async toggleCoupon(actor: string, id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cupão não encontrado');
    const updated = await this.prisma.coupon.update({ where: { id }, data: { active: !c.active } });
    this.audit.log(actor, 'SUPER_ADMIN', 'coupon.toggle', { code: c.code, active: updated.active });
    return updated;
  }
}
