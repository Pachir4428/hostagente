import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { TeamService } from './team.service';

@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class TeamController {
  constructor(private service: TeamService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId!);
  }

  @Post()
  invite(
    @CurrentUser() user: AuthUser,
    @Body() body: { email: string; name: string; password: string; canEdit?: boolean },
  ) {
    return this.service.invite(user.tenantId!, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { canEdit?: boolean }) {
    return this.service.update(user.tenantId!, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId!, id);
  }
}
