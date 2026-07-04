import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { BotsService } from './bots.service';

@Controller('bots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'STAFF')
export class BotsController {
  constructor(private service: BotsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId!);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; type?: 'auto' | 'manual'; phoneNumber?: string },
  ) {
    return this.service.create(user.tenantId!, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.tenantId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; phoneNumber?: string | null; config?: any },
  ) {
    return this.service.update(user.tenantId!, id, body);
  }

  @Post(':id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.start(user.tenantId!, id);
  }

  @Post(':id/stop')
  stop(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.stop(user.tenantId!, id);
  }

  @Post(':id/restart')
  restart(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.restart(user.tenantId!, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId!, id);
  }

  @Get(':id/live')
  live(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.live(user.tenantId!, id);
  }

  @Get(':id/script')
  getScript(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getScript(user.tenantId!, id);
  }

  @Post(':id/script')
  saveScript(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.service.saveScript(user.tenantId!, id, body.content ?? '');
  }
}
