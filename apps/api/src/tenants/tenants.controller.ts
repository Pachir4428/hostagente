import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { TenantsService } from './tenants.service';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantsController {
  constructor(private service: TenantsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.service.setStatus(id, 'suspended');
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.service.setStatus(id, 'active');
  }

  @Post(':id/impersonate')
  impersonate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.impersonate(user.email, id);
  }
}
