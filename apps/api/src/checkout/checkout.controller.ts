import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { CheckoutService } from './checkout.service';

@Controller('checkout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class CheckoutController {
  constructor(private service: CheckoutService) {}

  @Get('options')
  options(@CurrentUser() user: AuthUser) {
    return this.service.options(user.tenantId!);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { planId: string; gateway: 'visa' | 'paypal' | 'mpesa' | 'emola' },
  ) {
    return this.service.create(user.tenantId!, body.planId, body.gateway);
  }

  @Post(':invoiceId/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('invoiceId') invoiceId: string) {
    return this.service.confirm(user.tenantId!, invoiceId);
  }
}
