import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole, ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Tenant-scoped endpoints need a tenantId on the token. A stale token
    // issued before the multi-tenant pivot won't have one — force a re-login
    // (401) instead of letting downstream Prisma queries crash with a 500.
    const tenantScoped = required.includes('TENANT_ADMIN') || required.includes('STAFF');
    if (tenantScoped && user.role !== 'SUPER_ADMIN' && !user.tenantId) {
      throw new UnauthorizedException('Sessão inválida — inicia sessão novamente.');
    }
    return true;
  }
}
