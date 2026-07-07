import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { BillingService } from './billing.service';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BillingController {
  constructor(private service: BillingService) {}

  @Get('invoices')
  pending() {
    return this.service.pending();
  }

  @Post('invoices/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirm(id);
  }

  @Post('invoices/:id/reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
