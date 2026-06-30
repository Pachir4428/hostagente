import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  findAll() {
    return this.plansService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  getSubscription(@Request() req) {
    return this.plansService.getUserSubscription(req.user.id);
  }
}
