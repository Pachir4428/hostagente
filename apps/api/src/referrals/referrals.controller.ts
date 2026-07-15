import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { ReferralsService } from './referrals.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferralsController {
  constructor(private service: ReferralsService) {}

  @Get('referrals')
  @Roles('TENANT_ADMIN')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user.tenantId!);
  }

  @Get('admin/referrals/ranking')
  @Roles('SUPER_ADMIN')
  ranking() {
    return this.service.ranking();
  }
}
