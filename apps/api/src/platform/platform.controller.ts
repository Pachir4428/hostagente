import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get('health')
  health() {
    return this.service.health();
  }

  @Get('growth')
  growth() {
    return this.service.growth();
  }

  @Get('bots')
  bots() {
    return this.service.bots();
  }

  @Post('bots/:id/:action')
  botAction(@Param('id') id: string, @Param('action') action: 'stop' | 'restart') {
    return this.service.botAction(id, action === 'restart' ? 'restart' : 'stop');
  }
}
