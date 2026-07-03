import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { ApiKeysService } from './apikeys.service';

@Controller('account')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class ApiKeysController {
  constructor(private service: ApiKeysService) {}

  @Get()
  account(@CurrentUser() user: AuthUser) {
    return this.service.account(user.tenantId!);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body() body: { name?: string; contact?: string; receivingNumber?: string },
  ) {
    return this.service.updateAccount(user.tenantId!, body);
  }

  @Get('api-keys')
  keys(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId!);
  }

  @Post('api-keys/regenerate')
  regenerate(@CurrentUser() user: AuthUser) {
    return this.service.regenerate(user.tenantId!);
  }
}
