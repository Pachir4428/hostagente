import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BotsService } from './bots.service';

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private botsService: BotsService) {}

  @Post()
  create(@Request() req, @Body() body: { name: string; phoneNumber?: string }) {
    return this.botsService.create(req.user.id, body);
  }

  @Get()
  findAll(@Request() req) {
    return this.botsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.botsService.findOne(req.user.id, id);
  }

  @Post(':id/start')
  start(@Request() req, @Param('id') id: string) {
    return this.botsService.startBot(req.user.id, id);
  }

  @Post(':id/stop')
  stop(@Request() req, @Param('id') id: string) {
    return this.botsService.stopBot(req.user.id, id);
  }

  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.botsService.deleteBot(req.user.id, id);
  }
}
