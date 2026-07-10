import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { RevenueService } from './revenue.service';

@Controller('admin/revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class RevenueController {
  constructor(private service: RevenueService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }
}
