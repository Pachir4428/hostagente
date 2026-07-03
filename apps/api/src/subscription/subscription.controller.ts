import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class SubscriptionController {
  constructor(private service: SubscriptionService) {}

  @Get()
  current(@CurrentUser() user: AuthUser) {
    return this.service.current(user.tenantId!);
  }

  @Get('plans')
  plans() {
    return this.service.plans();
  }

  @Get('invoices')
  invoices(@CurrentUser() user: AuthUser) {
    return this.service.invoices(user.tenantId!);
  }

  @Post('change')
  change(@CurrentUser() user: AuthUser, @Body() body: { planId: string }) {
    return this.service.changePlan(user.tenantId!, body.planId);
  }
}
