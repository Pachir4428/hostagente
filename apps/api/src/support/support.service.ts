import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // ---- Tenant ----
  listForTenant(tenantId: string) {
    return this.prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async create(tenantId: string, subject: string, body: string) {
    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        subject,
        messages: { create: { authorRole: 'TENANT_ADMIN', body } },
      },
      include: { messages: true },
    });
  }

  async thread(tenantId: string | null, id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, tenant: { select: { name: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    return ticket;
  }

  async reply(
    tenantId: string | null,
    id: string,
    body: string,
    authorRole: 'TENANT_ADMIN' | 'STAFF' | 'SUPER_ADMIN',
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    await this.prisma.ticketMessage.create({ data: { ticketId: id, authorRole, body } });
    await this.prisma.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });
    return this.thread(tenantId, id);
  }

  // ---- Super admin ----
  listAll(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status === 'open' || status === 'resolved' ? { status } : {},
      orderBy: { updatedAt: 'desc' },
      include: { tenant: { select: { name: true } }, _count: { select: { messages: true } } },
    });
  }

  async setStatus(id: string, status: 'open' | 'resolved') {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    return this.prisma.supportTicket.update({ where: { id }, data: { status } });
  }
}
