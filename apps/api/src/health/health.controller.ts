import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
