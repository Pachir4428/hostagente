import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const RUNNER_URL = process.env.RUNNER_INTERNAL_URL || 'http://bot-runner:4001';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/data/projects';

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

  /** Save a single-file bot (bot.js) into the project dir. */
  async saveScript(tenantId: string, id: string, content: string) {
    await this.get(tenantId, id);
    const dir = path.join(PROJECTS_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bot.js'), content, 'utf8');
    await this.prisma.bot.update({ where: { id }, data: { hasScript: true } });
    return { success: true };
  }

  async getScript(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      const content = await fs.readFile(path.join(PROJECTS_DIR, id, 'bot.js'), 'utf8');
      return { content };
    } catch {
      return { content: '' };
    }
  }

  /** Save an uploaded project ZIP; the engine extracts it on next start. */
  async saveProjectZip(tenantId: string, id: string, buffer?: Buffer) {
    await this.get(tenantId, id);
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Nenhum ficheiro recebido.');
    }
    const dir = path.join(PROJECTS_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'project.zip'), buffer);
    await this.prisma.bot.update({ where: { id }, data: { hasScript: true } });
    return { success: true, message: 'Projeto carregado. Inicia (ou reinicia) o bot para descompactar e correr.' };
  }

  // ── File manager ──────────────────────────────────────────────
  private baseDir(id: string) {
    return path.join(PROJECTS_DIR, id);
  }

  // Resolve a relative path safely inside the bot's project dir (no traversal).
  private safe(id: string, rel: string) {
    const base = this.baseDir(id);
    const p = path.resolve(base, rel || '.');
    if (p !== base && !p.startsWith(base + path.sep)) {
      throw new BadRequestException('Caminho inválido');
    }
    return p;
  }

  async listFiles(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const base = this.baseDir(id);
    const out: { path: string; type: 'file' | 'dir'; size: number }[] = [];
    const skip = new Set(['node_modules', '.git']);
    async function walk(dir: string, prefix: string, depth: number) {
      if (depth > 6) return;
      let entries: any[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) {
          out.push({ path: rel, type: 'dir', size: 0 });
          if (!skip.has(e.name)) await walk(path.join(dir, e.name), rel, depth + 1);
        } else {
          let size = 0;
          try {
            size = (await fs.stat(path.join(dir, e.name))).size;
          } catch {
            /* ignore */
          }
          out.push({ path: rel, type: 'file', size });
        }
        if (out.length > 2000) return;
      }
    }
    try {
      await walk(base, '', 0);
    } catch {
      /* ignore */
    }
    out.sort((a, b) => a.path.localeCompare(b.path));
    return out;
  }

  async readFile(tenantId: string, id: string, rel: string) {
    await this.get(tenantId, id);
    const p = this.safe(id, rel);
    try {
      const stat = await fs.stat(p);
      if (stat.size > 1024 * 1024) return { content: '', tooLarge: true };
      const content = await fs.readFile(p, 'utf8');
      return { content };
    } catch {
      return { content: '', notFound: true };
    }
  }

  async writeFileContent(tenantId: string, id: string, rel: string, content: string) {
    await this.get(tenantId, id);
    const p = this.safe(id, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content ?? '', 'utf8');
    await this.prisma.bot.update({ where: { id }, data: { hasScript: true } }).catch(() => null);
    return { success: true };
  }

  async deletePath(tenantId: string, id: string, rel: string) {
    await this.get(tenantId, id);
    const p = this.safe(id, rel);
    if (p === this.baseDir(id)) throw new BadRequestException('Não podes apagar a raiz');
    await fs.rm(p, { recursive: true, force: true });
    return { success: true };
  }

  /** Save many uploaded files preserving their relative paths (folder upload). */
  async saveFiles(
    tenantId: string,
    id: string,
    files: { rel: string; buffer: Buffer }[],
  ) {
    await this.get(tenantId, id);
    let count = 0;
    for (const f of files) {
      if (!f.rel) continue;
      const p = this.safe(id, f.rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, f.buffer);
      count++;
    }
    if (count > 0) await this.prisma.bot.update({ where: { id }, data: { hasScript: true } }).catch(() => null);
    return { success: true, count };
  }

  /** Run a shell command inside the bot's container (streamed to the console). */
  async sendCommand(tenantId: string, id: string, command: string) {
    await this.get(tenantId, id);
    try {
      await this.redis.publish(`bot:${id}:cmd`, command);
      return { success: true };
    } catch {
      return { success: false, message: 'Redis indisponível — o bot precisa de estar a correr.' };
    }
  }

  /** Forward a line to the running process stdin. */
  async sendStdin(tenantId: string, id: string, input: string) {
    await this.get(tenantId, id);
    try {
      await this.redis.publish(`bot:${id}:stdin`, input);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  private runnerError(err: any): string {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return 'O serviço bot-runner não está disponível. Confirma que o container bot-runner está a correr.';
    }
    return err.response?.data?.message || err.message || 'Erro no bot-runner';
  }
}
