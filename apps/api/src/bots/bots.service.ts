import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerService } from '../runner/runner.service';

@Injectable()
export class BotsService {
  constructor(
    private prisma: PrismaService,
    private runner: RunnerService,
  ) {}

  async create(userId: string, data: { name: string; phoneNumber?: string }) {
    return this.prisma.bot.create({
      data: { ...data, userId, status: 'stopped' },
    });
  }

  async findAll(userId: string) {
    return this.prisma.bot.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(userId: string, botId: string) {
    const bot = await this.prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new NotFoundException('Bot not found');
    if (bot.userId !== userId) throw new ForbiddenException();
    return bot;
  }

  async startBot(userId: string, botId: string) {
    const bot = await this.findOne(userId, botId);
    await this.prisma.bot.update({ where: { id: botId }, data: { status: 'starting' } });
    const result = await this.runner.startBot(botId);
    if (result.containerId) {
      await this.prisma.bot.update({
        where: { id: botId },
        data: { containerId: result.containerId, status: 'starting' },
      });
    }
    return result;
  }

  async stopBot(userId: string, botId: string) {
    const bot = await this.findOne(userId, botId);
    await this.prisma.bot.update({ where: { id: botId }, data: { status: 'stopping' } });
    const result = await this.runner.stopBot(botId);
    await this.prisma.bot.update({ where: { id: botId }, data: { status: 'stopped', containerId: null } });
    return result;
  }

  async deleteBot(userId: string, botId: string) {
    const bot = await this.findOne(userId, botId);
    if (bot.status !== 'stopped') {
      await this.runner.stopBot(botId).catch(() => {});
    }
    return this.prisma.bot.delete({ where: { id: botId } });
  }

  async updateStatus(botId: string, status: string, containerId?: string) {
    return this.prisma.bot.update({
      where: { id: botId },
      data: { status, ...(containerId !== undefined ? { containerId } : {}) },
    });
  }
}
