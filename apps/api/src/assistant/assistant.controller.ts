import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssistantService } from './assistant.service';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private service: AssistantService) {}

  @Post('chat')
  chat(@Body() body: { messages: { role: 'user' | 'assistant'; content: string }[] }) {
    return this.service.chat(body?.messages || []);
  }
}
