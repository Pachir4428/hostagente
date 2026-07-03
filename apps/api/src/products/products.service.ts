import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductInput {
  amount: number;
  description: string;
  megabytes?: number | null;
  operator?: 'mpesa' | 'emola' | 'mkesh' | null;
  autoDetect?: boolean;
  active?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { amount: 'asc' },
    });
  }

  create(tenantId: string, data: ProductInput) {
    return this.prisma.product.create({
      data: {
        tenantId,
        amount: data.amount,
        description: data.description,
        megabytes: data.megabytes ?? null,
        operator: data.operator ?? null,
        autoDetect: data.autoDetect ?? true,
        active: data.active ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, data: Partial<ProductInput>) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Pacote não encontrado');
    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Pacote não encontrado');
    // Soft-disable to preserve transaction history references.
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }
}
