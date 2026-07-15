import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('coupon')
  coupon(@Query('code') code: string) {
    return this.service.validateCoupon(code || '');
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { planId: string; gateway: 'visa' | 'paypal' | 'mpesa' | 'emola'; coupon?: string },
  ) {
    return this.service.create(user.tenantId!, body.planId, body.gateway, body.coupon);
  }

  @Post(':invoiceId/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('invoiceId') invoiceId: string) {
    return this.service.confirm(user.tenantId!, invoiceId);
  }

  @Post(':invoiceId/submit')
  submit(@CurrentUser() user: AuthUser, @Param('invoiceId') invoiceId: string) {
    return this.service.submit(user.tenantId!, invoiceId);
  }
}
