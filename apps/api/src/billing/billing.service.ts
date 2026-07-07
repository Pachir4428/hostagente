import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  /** Invoices needing admin action (manual gateway payments), newest first. */
  async pending() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ['pending', 'awaiting'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const tenantIds = [...new Set(invoices.map((i) => i.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const plans = await this.prisma.plan.findMany({ select: { id: true, name: true } });
    const tName = new Map(tenants.map((t) => [t.id, t.name]));
    const pName = new Map(plans.map((p) => [p.id, p.name]));
    return invoices.map((i) => ({
      id: i.id,
      tenant: tName.get(i.tenantId) || i.tenantId,
      plan: i.planId ? pName.get(i.planId) || null : null,
      amount: i.amount,
      gateway: i.gateway,
      reference: i.reference,
      status: i.status,
      createdAt: i.createdAt,
    }));
  }

  /** Confirm a payment: mark the invoice paid and activate the tenant's plan. */
  async confirm(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (!invoice.planId) throw new BadRequestException('Fatura sem plano associado');

    const nextPeriod = new Date();
    nextPeriod.setMonth(nextPeriod.getMonth() + 1);

    await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'paid' } }),
      this.prisma.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          planId: invoice.planId,
          status: 'active',
          subscription: {
            upsert: {
              create: { planId: invoice.planId, status: 'active', currentPeriodEnd: nextPeriod },
              update: { planId: invoice.planId, status: 'active', currentPeriodEnd: nextPeriod },
            },
          },
        },
      }),
    ]);

    // Notify the tenant that their plan is active.
    const plan = await this.prisma.plan.findUnique({ where: { id: invoice.planId } });
    const to = await this.mail.tenantAdminEmail(invoice.tenantId);
    await this.mail.send(
      to,
      'Pagamento confirmado — plano ativado',
      `<p>O teu pagamento de <b>${invoice.amount} MZN</b> foi confirmado.</p>
       <p>O plano <b>${plan?.name || ''}</b> está agora ativo. Obrigado!</p>
       <p>— HostAgente</p>`,
    );
    return { success: true };
  }

  /** Reject a payment: mark the invoice failed. Plan is not changed. */
  async reject(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'failed' } });
    return { success: true };
  }
}
