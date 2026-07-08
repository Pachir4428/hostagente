import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';

// Public branding (white-label) — no auth so the landing page and login can
// render the tenant's logo, name, favicon and colours before sign-in.
@Controller('branding')
export class BrandingController {
  constructor(private service: SettingsService) {}

  @Get()
  get() {
    return this.service.getBranding();
  }
}
