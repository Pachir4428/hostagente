import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  /** Render a simple PDF receipt for an invoice. */
  async invoicePdf(tenantId: string, invoiceId: string, res: any) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const branding: any = await this.settings.getBranding().catch(() => ({ appName: 'HostAgente' }));
    const appName = branding.appName || 'HostAgente';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recibo-${invoice.id.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    doc.fillColor('#22D3AA').fontSize(24).text(appName);
    doc.moveDown(0.2);
    doc.fillColor('#666').fontSize(11).text('Recibo de pagamento');
    doc.moveDown(1.5);

    doc.fillColor('#111').fontSize(12);
    const row = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(label, { continued: true }).font('Helvetica').text('  ' + value);
      doc.moveDown(0.4);
    };
    row('Recibo Nº:', invoice.id);
    row('Data:', new Date(invoice.createdAt).toLocaleString('pt-PT'));
    row('Cliente:', tenant?.name || tenantId);
    if (invoice.gateway) row('Método:', invoice.gateway);
    if (invoice.reference) row('Referência:', invoice.reference);
    row('Estado:', invoice.status === 'paid' ? 'PAGO' : invoice.status);

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111').text('Total: ' + invoice.amount.toFixed(2) + ' MZN', { align: 'right' });

    doc.moveDown(3);
    doc.font('Helvetica').fontSize(9).fillColor('#999999').text(`Gerado por ${appName} · ${new Date().toLocaleDateString('pt-PT')}`, { align: 'center' });
    doc.end();
  }

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
