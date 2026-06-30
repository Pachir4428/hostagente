import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plan.findMany({ where: { isActive: true } });
  }

  async findById(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async getUserSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
