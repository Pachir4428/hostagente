import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';

type GatewayId = 'visa' | 'paypal' | 'mpesa' | 'emola';

const LABELS: Record<GatewayId, string> = {
  visa: 'Cartão (Visa/Mastercard)',
  paypal: 'PayPal',
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
};

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private mail: MailService,
  ) {}

  async options(_tenantId: string) {
    const [plans, gateways] = await Promise.all([
      this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } }),
      this.settings.publicGateways(),
    ]);
    const enabled = (Object.keys(gateways) as GatewayId[])
      .filter((k) => gateways[k]?.enabled)
      .map((k) => ({ id: k, label: LABELS[k], number: gateways[k].number || null }));
    return { plans, gateways: enabled };
  }

  async create(tenantId: string, planId: string, gateway: GatewayId) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plano inválido');

    const all = await this.settings.getGateways();
    const cfg = all[gateway];
    if (!cfg || !cfg.enabled) {
      throw new BadRequestException('Método de pagamento indisponível.');
    }

    const reference = `HA-${Date.now().toString(36).toUpperCase()}`;
    const invoice = await this.prisma.invoice.create({
      data: { tenantId, amount: plan.priceMonthly, status: 'pending', gateway, reference, planId },
    });

    let instructions = '';
    let requiresManual = false;
    if (gateway === 'mpesa' || gateway === 'emola') {
      requiresManual = true;
      instructions = `Envia ${plan.priceMonthly} MZN para o número ${cfg.number || '(não configurado)'} via ${LABELS[gateway]}, usando a referência ${reference}. Depois clica em "Já paguei" para ativarmos o plano.`;
    } else {
      instructions = `Serás encaminhado para ${LABELS[gateway]} (${cfg.mode || 'sandbox'}) para concluir o pagamento de ${plan.priceMonthly} MZN.`;
    }

    return {
      invoiceId: invoice.id,
      reference,
      amount: plan.priceMonthly,
      gateway,
      label: LABELS[gateway],
      requiresManual,
      instructions,
    };
  }

  /**
   * Card/PayPal success callback: activates the plan immediately.
   * (Real provider capture is a later phase; this simulates a successful return.)
   */
  async confirm(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (!invoice.planId) throw new BadRequestException('Fatura sem plano associado');

    const nextPeriod = new Date();
    nextPeriod.setMonth(nextPeriod.getMonth() + 1);

    await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'paid' } }),
      this.prisma.tenant.update({
        where: { id: tenantId },
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

    return { success: true, activated: true };
  }

  /**
   * M-Pesa/e-Mola "Já paguei": marks the invoice as awaiting admin review.
   * The plan is only activated when the SUPER_ADMIN confirms the payment in
   * the billing reconciliation page.
   */
  async submit(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'awaiting' } });

    // Alert the super admin that a manual payment needs confirmation.
    const to = await this.mail.superAdminEmail();
    await this.mail.send(
      to,
      'Novo pagamento a aguardar confirmação',
      `<p>Um revendedor submeteu um pagamento (${invoice.amount} MZN, ref. ${invoice.reference || '—'}, via ${invoice.gateway || '—'}).</p>
       <p>Confirma ou rejeita na página <b>Pagamentos</b> do painel.</p>`,
    );
    return { success: true, activated: false };
  }
}
