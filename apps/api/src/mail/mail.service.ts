import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

// nodemailer is required lazily so the API still boots if it isn't installed.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let nodemailer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private settings: SettingsService,
    private prisma: PrismaService,
  ) {}

  /** Send an email if SMTP is configured; otherwise no-op (logs a warning). */
  async send(to: string | undefined, subject: string, html: string) {
    if (!to) return { sent: false, reason: 'no-recipient' };
    const cfg = await this.settings.getSmtp();
    if (!cfg.enabled || !cfg.host || !nodemailer) {
      this.logger.warn(`Email não enviado (SMTP desativado/incompleto): ${subject} -> ${to}`);
      return { sent: false, reason: 'smtp-disabled' };
    }
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port || 587,
        secure: !!cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
      await transporter.sendMail({
        from: cfg.from || cfg.user,
        to,
        subject,
        html,
      });
      return { sent: true };
    } catch (err: any) {
      this.logger.error(`Falha ao enviar email: ${err?.message}`);
      return { sent: false, reason: err?.message };
    }
  }

  /** Email of the tenant's admin user (for payment/plan notifications). */
  async tenantAdminEmail(tenantId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, role: 'TENANT_ADMIN' },
      select: { email: true },
    });
    return user?.email;
  }

  /** Email of a platform super admin (for reconciliation alerts). */
  async superAdminEmail(): Promise<string | undefined> {
    const user = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { email: true },
    });
    return user?.email;
  }
}
