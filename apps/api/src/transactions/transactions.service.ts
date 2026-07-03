import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TxFilter {
  phone?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, filter: TxFilter) {
    const page = Math.max(1, Number(filter.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filter.pageSize) || 20));

    const where: any = { tenantId };
    if (filter.phone) where.phoneNumber = { contains: filter.phone };
    if (filter.status) where.status = filter.status;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) {
        const end = new Date(filter.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { product: { select: { description: true, megabytes: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }
}
