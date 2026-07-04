import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const RUNNER_URL = process.env.RUNNER_INTERNAL_URL || 'http://bot-runner:4001';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || '/data/scripts';

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);
  private redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

  constructor(private prisma: PrismaService) {
    this.redis.on('error', () => {}); // don't crash on redis blips
  }

  private runner(method: 'post', url: string, body?: any) {
    return axios[method](`${RUNNER_URL}${url}`, body, {
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      timeout: 15000,
    });
  }

  list(tenantId: string) {
    return this.prisma.bot.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async get(tenantId: string, id: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id, tenantId } });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }

  create(tenantId: string, data: { name: string; type?: 'auto' | 'manual'; phoneNumber?: string }) {
    return this.prisma.bot.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type ?? 'manual',
        phoneNumber: data.phoneNumber || null,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: { name?: string; phoneNumber?: string | null; config?: any },
  ) {
    await this.get(tenantId, id);
    const bot = await this.prisma.bot.update({ where: { id }, data });
    // Publish config so a running engine can pick it up.
    if (data.config !== undefined) {
      try {
        await this.redis.set(`bot:${id}:config`, JSON.stringify(data.config ?? {}));
      } catch {
        /* ignore */
      }
    }
    return bot;
  }

  async start(tenantId: string, id: string) {
    const bot = await this.get(tenantId, id);
    if (bot.type !== 'manual') {
      return { success: false, message: 'Só bots manuais são executados pela plataforma.' };
    }
    await this.prisma.bot.update({ where: { id }, data: { status: 'starting' } });
    try {
      const res = await this.runner('post', '/bots/start', { botId: id, phone: bot.phoneNumber });
      if (res.data?.containerId) {
        await this.prisma.bot.update({ where: { id }, data: { containerId: res.data.containerId } });
      }
      return res.data;
    } catch (err: any) {
      await this.prisma.bot.update({ where: { id }, data: { status: 'error' } });
      return { success: false, message: this.runnerError(err) };
    }
  }

  async stop(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      await this.runner('post', '/bots/stop', { botId: id });
    } catch (err: any) {
      this.logger.warn(`stop bot ${id}: ${this.runnerError(err)}`);
    }
    await this.prisma.bot.update({ where: { id }, data: { status: 'stopped' } });
    try {
      await this.redis.del(`bot:${id}:qr`, `bot:${id}:pairing`);
    } catch {
      /* ignore */
    }
    return { success: true };
  }

  async restart(tenantId: string, id: string) {
    const bot = await this.get(tenantId, id);
    await this.prisma.bot.update({ where: { id }, data: { status: 'starting' } });
    try {
      const res = await this.runner('post', '/bots/restart', { botId: id, phone: bot.phoneNumber });
      return res.data;
    } catch (err: any) {
      return { success: false, message: this.runnerError(err) };
    }
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      await this.runner('post', '/bots/stop', { botId: id });
    } catch {
      /* ignore */
    }
    await this.prisma.bot.delete({ where: { id } });
    return { success: true };
  }

  /** Live console data (status/qr/pairing/logs) from Redis. */
  async live(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      const [status, qr, pairing, logs] = await Promise.all([
        this.redis.get(`bot:${id}:status`),
        this.redis.get(`bot:${id}:qr`),
        this.redis.get(`bot:${id}:pairing`),
        this.redis.lrange(`bot:${id}:logs`, -200, -1),
      ]);
      // Keep the DB status roughly in sync for the list view.
      if (status) {
        await this.prisma.bot
          .update({ where: { id }, data: { status: status as any } })
          .catch(() => null);
      }
      return { status: status || 'stopped', qr, pairing, logs: logs || [] };
    } catch {
      return { status: 'stopped', qr: null, pairing: null, logs: [], redisError: true };
    }
  }

  async saveScript(tenantId: string, id: string, content: string) {
    await this.get(tenantId, id);
    const dir = path.join(SCRIPTS_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bot.js'), content, 'utf8');
    await this.prisma.bot.update({ where: { id }, data: { hasScript: true } });
    return { success: true };
  }

  async getScript(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      const content = await fs.readFile(path.join(SCRIPTS_DIR, id, 'bot.js'), 'utf8');
      return { content };
    } catch {
      return { content: '' };
    }
  }

  private runnerError(err: any): string {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return 'O serviço bot-runner não está disponível. Confirma que o container bot-runner está a correr.';
    }
    return err.response?.data?.message || err.message || 'Erro no bot-runner';
  }
}
