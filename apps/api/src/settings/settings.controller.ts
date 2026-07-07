import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { SettingsService, Gateways, AssistantConfig, SmtpConfig } from './settings.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get()
  get() {
    return this.service.adminView();
  }

  @Put('gateways')
  saveGateways(@Body() body: Partial<Gateways>) {
    return this.service.saveGateways(body);
  }

  @Put('assistant')
  saveAssistant(@Body() body: Partial<AssistantConfig>) {
    return this.service.saveAssistant(body);
  }

  @Put('smtp')
  saveSmtp(@Body() body: Partial<SmtpConfig>) {
    return this.service.saveSmtp(body);
  }
}
