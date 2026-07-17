import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const PLANS = [
  { name: 'Starter', priceMonthly: 0, maxTransactions: 200, maxUsers: 1, maxBots: 1, features: ['1 SIM', 'Deteção automática', 'Suporte comunitário'] },
  { name: 'Pro', priceMonthly: 750, maxTransactions: 5000, maxUsers: 3, maxBots: 5, features: ['SIMs ilimitados', 'Exportação CSV/PDF', 'Suporte prioritário'] },
  { name: 'Business', priceMonthly: 2500, maxTransactions: 50000, maxUsers: 10, maxBots: 50, features: ['Tudo do Pro', 'Equipa & permissões', 'API dedicada'] },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedPlans();
      await this.seedSuperAdmin();
    } catch (err: any) {
      // Don't crash boot if the DB isn't migrated yet; deploy runs db push next.
      this.logger.warn(`Seed skipped: ${err?.message ?? err}`);
    }
  }

  private async seedPlans() {
    for (const p of PLANS) {
      await this.prisma.plan.upsert({
        where: { name: p.name },
        update: {
          priceMonthly: p.priceMonthly,
          maxTransactions: p.maxTransactions,
          maxUsers: p.maxUsers,
          maxBots: p.maxBots,
          features: p.features,
        },
        create: p,
      });
    }
    this.logger.log('Plans seeded');
  }

  private async seedSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.create({
      data: { email, name: 'Super Admin', passwordHash, role: 'SUPER_ADMIN', tenantId: null },
    });
    this.logger.log(`Super admin created: ${email}`);
  }
}
