import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BroadcastService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list() {
    return this.prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async create(actor: string, title: string, body: string) {
    const b = await this.prisma.broadcast.create({ data: { title, body } });
    this.audit.log(actor, 'SUPER_ADMIN', 'broadcast.create', { id: b.id, title });
    return b;
  }
}
