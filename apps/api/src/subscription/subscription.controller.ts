import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('invoices/:id/pdf')
  invoicePdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return this.service.invoicePdf(user.tenantId!, id, res);
  }

  @Post('change')
  change(@CurrentUser() user: AuthUser, @Body() body: { planId: string }) {
    return this.service.changePlan(user.tenantId!, body.planId);
  }
}
