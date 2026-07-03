import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(actorEmail: string | null, actorRole: string | null, action: string, meta?: any) {
    return this.prisma.auditLog
      .create({ data: { actorEmail, actorRole, action, meta: meta ?? undefined } })
      .catch(() => null);
  }

  list() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
