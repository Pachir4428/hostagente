import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, role: true, canEdit: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(
    tenantId: string,
    data: { email: string; name: string; password: string; canEdit?: boolean },
  ) {
    // Enforce the plan's user limit.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, subscription: { include: { plan: true } }, _count: { select: { users: true } } },
    });
    const maxUsers = tenant?.subscription?.plan?.maxUsers ?? tenant?.plan?.maxUsers ?? 1;
    if ((tenant?._count.users ?? 0) >= maxUsers) {
      throw new ForbiddenException(`O teu plano permite no máximo ${maxUsers} utilizador(es).`);
    }

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Este email já está registado');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        passwordHash,
        role: 'STAFF',
        canEdit: data.canEdit ?? false,
      },
      select: { id: true, email: true, name: true, role: true, canEdit: true, createdAt: true },
    });
    return user;
  }

  async update(tenantId: string, id: string, data: { canEdit?: boolean }) {
    const member = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!member) throw new NotFoundException('Membro não encontrado');
    if (member.role === 'TENANT_ADMIN') throw new BadRequestException('Não podes alterar o administrador');
    return this.prisma.user.update({
      where: { id },
      data: { canEdit: data.canEdit },
      select: { id: true, email: true, name: true, role: true, canEdit: true, createdAt: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const member = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!member) throw new NotFoundException('Membro não encontrado');
    if (member.role === 'TENANT_ADMIN') throw new BadRequestException('Não podes remover o administrador');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
