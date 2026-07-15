import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

function newApiKey(): string {
  return 'hka_' + randomBytes(24).toString('hex');
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

@Injectable()
export class AuthService {
  private redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private mail: MailService,
  ) {
    this.redis.on('error', () => {});
  }

  /** Start 2FA: email a 6-digit code and return a temp token to verify with. */
  async beginTwoFactor(user: { id: string; email: string }) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const tempToken = randomBytes(24).toString('hex');
    try {
      await this.redis.set(`2fa:${tempToken}`, JSON.stringify({ userId: user.id, code }), 'EX', 600);
    } catch {
      // If Redis is down, fail safe by not requiring 2FA (avoid lockout).
      return null;
    }
    await this.mail
      .send(user.email, 'O teu código de acesso', `<p>O teu código de verificação é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>Expira em 10 minutos.</p>`)
      .catch(() => null);
    return { twoFactorRequired: true, tempToken };
  }

  /** Verify a 2FA code and issue tokens. */
  async verifyTwoFactor(tempToken: string, code: string) {
    let raw: string | null = null;
    try {
      raw = await this.redis.get(`2fa:${tempToken}`);
    } catch {
      throw new BadRequestException('Sessão de verificação indisponível');
    }
    if (!raw) throw new UnauthorizedException('Código expirado. Entra novamente.');
    const data = JSON.parse(raw);
    if (String(code).trim() !== data.code) throw new UnauthorizedException('Código incorreto');
    await this.redis.del(`2fa:${tempToken}`).catch(() => null);
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new UnauthorizedException('Utilizador não encontrado');
    const { passwordHash, ...result } = user;
    return this.login(result);
  }

  async setTwoFactor(userId: string, enabled: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: enabled } });
    return { success: true, twoFactorEnabled: enabled };
  }

  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } }).catch(() => null);
    return !!u?.twoFactorEnabled;
  }

  async validateUser(email: string, password: string): Promise<any> {
    // Select only stable columns so a pending migration (e.g. new column)
    // can't break login. 2FA state is fetched defensively elsewhere.
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true, role: true, tenantId: true },
    });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');
    const { passwordHash, ...result } = user;
    return result;
  }

  private sign(user: { id: string; email: string; role: string; tenantId: string | null }) {
    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  async login(user: any) {
    const { accessToken, refreshToken } = this.sign(user);
    return { accessToken, refreshToken, user };
  }

  /**
   * Registration creates a new Tenant (the revendedor's business) and its
   * first TENANT_ADMIN user, starts a 14-day trial on the Starter plan, and
   * provisions a MacroDroid API key.
   */
  async register(email: string, password: string, name: string, businessName?: string, ref?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Este email já está registado');

    const passwordHash = await bcrypt.hash(password, 10);
    const starter = await this.prisma.plan.findFirst({ where: { name: 'Starter' } });
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Resolve referrer from the invite code, and mint a code for the new tenant.
    let referredById: string | null = null;
    if (ref?.trim()) {
      const referrer = await this.prisma.tenant.findUnique({ where: { referralCode: ref.trim().toUpperCase() } });
      referredById = referrer?.id ?? null;
    }
    const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    const tenant = await this.prisma.tenant.create({
      data: {
        name: businessName?.trim() || name,
        status: 'trial',
        planId: starter?.id ?? null,
        referralCode,
        referredById,
        users: {
          create: { email, passwordHash, name, role: 'TENANT_ADMIN' },
        },
        apiKeys: { create: { key: newApiKey() } },
        ...(starter
          ? {
              subscription: {
                create: { planId: starter.id, status: 'trial', currentPeriodEnd: trialEnd },
              },
            }
          : {}),
      },
      include: { users: true },
    });

    const user = tenant.users[0];
    const { passwordHash: _, ...result } = user;
    return this.login(result);
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      const { passwordHash, ...userResult } = user;
      return this.login(userResult);
    } catch {
      throw new UnauthorizedException('Token de refresh inválido');
    }
  }
}
