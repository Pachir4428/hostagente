import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'STAFF')
export class SupportController {
  constructor(private service: SupportService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listForTenant(user.tenantId!);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { subject: string; body: string }) {
    return this.service.create(user.tenantId!, body.subject, body.body);
  }

  @Get(':id')
  thread(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.thread(user.tenantId!, id);
  }

  @Post(':id/messages')
  reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { body: string }) {
    return this.service.reply(user.tenantId!, id, body.body, user.role as any);
  }
}

@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSupportController {
  constructor(private service: SupportService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.listAll(status);
  }

  @Get(':id')
  thread(@Param('id') id: string) {
    return this.service.thread(null, id);
  }

  @Post(':id/messages')
  reply(@Param('id') id: string, @Body() body: { body: string }) {
    return this.service.reply(null, id, body.body, 'SUPER_ADMIN');
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.service.setStatus(id, 'resolved');
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.service.setStatus(id, 'open');
  }
}
