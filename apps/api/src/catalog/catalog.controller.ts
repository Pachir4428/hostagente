import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { CatalogService, PlanInput } from './catalog.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CatalogController {
  constructor(private service: CatalogService) {}

  @Get('plans')
  plans() {
    return this.service.listPlans();
  }

  @Post('plans')
  createPlan(@CurrentUser() user: AuthUser, @Body() body: PlanInput) {
    return this.service.createPlan(user.email, body);
  }

  @Patch('plans/:id')
  updatePlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<PlanInput>) {
    return this.service.updatePlan(user.email, id, body);
  }

  @Get('coupons')
  coupons() {
    return this.service.listCoupons();
  }

  @Post('coupons')
  createCoupon(
    @CurrentUser() user: AuthUser,
    @Body() body: { code: string; discountPct: number; expiresAt?: string },
  ) {
    return this.service.createCoupon(user.email, body);
  }

  @Patch('coupons/:id/toggle')
  toggleCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.toggleCoupon(user.email, id);
  }
}
