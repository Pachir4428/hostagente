import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PlatformService } from './platform.service';

@Controller('admin/platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PlatformController {
  constructor(private service: PlatformService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }
}
