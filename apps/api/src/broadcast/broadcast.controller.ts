import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { BroadcastService } from './broadcast.service';

@Controller('admin/broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BroadcastController {
  constructor(private service: BroadcastService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { title: string; body: string }) {
    return this.service.create(user.email, body.title, body.body);
  }
}

// Tenants read the same broadcasts as announcements.
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'STAFF')
export class AnnouncementsController {
  constructor(private service: BroadcastService) {}

  @Get()
  list() {
    return this.service.list();
  }
}
