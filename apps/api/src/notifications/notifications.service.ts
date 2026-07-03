import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(tenantId: string) {
    return this.prisma.notification.count({ where: { tenantId, read: false } });
  }

  async markRead(tenantId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, tenantId }, data: { read: true } });
    return { ok: true };
  }

  async markAllRead(tenantId: string) {
    await this.prisma.notification.updateMany({ where: { tenantId, read: false }, data: { read: true } });
    return { ok: true };
  }

  create(tenantId: string, type: string, title: string, message: string) {
    return this.prisma.notification.create({ data: { tenantId, type, title, message } });
  }
}
