import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

function newApiKey(): string {
  return 'hka_' + randomBytes(24).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
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
