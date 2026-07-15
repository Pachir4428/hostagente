import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

const RUNNER_URL = process.env.RUNNER_INTERNAL_URL || 'http://bot-runner:4001';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/data/projects';
// Internal URL the bot container uses to reach the API over the docker network.
const SELF_API_URL = process.env.SELF_API_URL || 'http://api:3000';

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);
  private redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {
    this.redis.on('error', () => {}); // don't crash on redis blips
  }

  /** The tenant's active API key, injected into the bot container so it can report back. */
  private async tenantApiKey(tenantId: string): Promise<string> {
    const key = await this.prisma.apiKey.findFirst({
      where: { tenantId, revoked: false },
      orderBy: { createdAt: 'desc' },
    });
    return key?.key || '';
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

  async create(tenantId: string, data: { name: string; type?: 'auto' | 'manual'; phoneNumber?: string }) {
    // Enforce the plan's bot limit.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } }, plan: true },
    });
    const plan = tenant?.subscription?.plan ?? tenant?.plan ?? null;
    const maxBots = plan?.maxBots ?? 1;
    const count = await this.prisma.bot.count({ where: { tenantId } });
    if (count >= maxBots) {
      throw new BadRequestException(
        `O teu plano${plan ? ` (${plan.name})` : ''} permite ${maxBots} bot(s). Faz upgrade em Assinatura para adicionar mais.`,
      );
    }
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
    const apiKey = await this.tenantApiKey(bot.tenantId);
    try {
      const res = await this.runner('post', '/bots/start', {
        botId: id,
        phone: bot.phoneNumber,
        apiKey,
        apiUrl: SELF_API_URL,
      });
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
    const apiKey = await this.tenantApiKey(bot.tenantId);
    try {
      const res = await this.runner('post', '/bots/restart', {
        botId: id,
        phone: bot.phoneNumber,
        apiKey,
        apiUrl: SELF_API_URL,
      });
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
    const bot = await this.get(tenantId, id);
    try {
      const [status, qr, pairing, logs, statsRaw, groupsRaw] = await Promise.all([
        this.redis.get(`bot:${id}:status`),
        this.redis.get(`bot:${id}:qr`),
        this.redis.get(`bot:${id}:pairing`),
        this.redis.lrange(`bot:${id}:logs`, -200, -1),
        this.redis.get(`bot:${id}:stats`),
        this.redis.get(`bot:${id}:groups`),
      ]);
      // Keep the DB status roughly in sync for the list view.
      if (status) {
        await this.prisma.bot
          .update({ where: { id }, data: { status: status as any } })
          .catch(() => null);
      }
      let stats: any = null;
      try {
        stats = statsRaw ? JSON.parse(statsRaw) : null;
      } catch {
        stats = null;
      }
      let reported: any[] = [];
      try {
        reported = groupsRaw ? JSON.parse(groupsRaw) : [];
      } catch {
        reported = [];
      }
      // Alert (once) when a manual bot has crashed and exhausted auto-restarts.
      if (status === 'error' && stats && stats.restarts >= 3) {
        await this.alertBotDown(bot).catch(() => null);
      } else if (status === 'connected') {
        await this.redis.del(`bot:${id}:alerted`).catch(() => null);
      }
      const groups = this.mergeGroups(bot, reported);
      return { status: status || 'stopped', qr, pairing, logs: logs || [], stats, groups };
    } catch {
      // Even if Redis is down, still show manually-registered groups.
      return { status: 'stopped', qr: null, pairing: null, logs: [], stats: null, groups: this.mergeGroups(bot, []), redisError: true };
    }
  }

  /**
   * Merge manually-registered groups (stored in bot.config.manualGroups) with
   * whatever the bot reported (matched by WhatsApp group id). Computes each
   * group's subscription "active" state from its validUntil date.
   */
  private mergeGroups(bot: any, reported: any[]): any[] {
    const manual: any[] = Array.isArray(bot?.config?.manualGroups) ? bot.config.manualGroups : [];
    // Group JIDs come as "12036...@g.us" but users enter just the number.
    const nid = (x: any) => String(x || '').split('@')[0].trim();
    const byId = new Map<string, any>();
    for (const r of reported || []) {
      if (r?.id) byId.set(nid(r.id), r);
    }
    const now = Date.now();
    const computeActive = (validUntil?: string, fallback?: boolean) => {
      if (validUntil) return new Date(validUntil).getTime() >= now;
      return fallback;
    };
    const out: any[] = manual.map((m) => {
      const rep = m.id ? byId.get(nid(m.id)) || {} : {};
      return {
        id: m.id,
        name: rep.name || m.name || m.id || 'Grupo',
        description: rep.description || m.description || '',
        admins: (rep.admins && rep.admins.length ? rep.admins : m.admins) || [],
        services: (rep.services && rep.services.length ? rep.services : m.services) || [],
        participants: rep.participants ?? m.participants,
        plan: m.plan || rep.plan,
        validUntil: m.validUntil,
        active: computeActive(m.validUntil, rep.active ?? m.active),
        manual: true,
      };
    });
    // Add reported groups that weren't registered manually.
    for (const r of reported || []) {
      if (!manual.some((m) => nid(m.id) === nid(r.id))) out.push(r);
    }
    return out;
  }

  /** All manually-registered group subscriptions across the tenant's bots. */
  async groupSubscriptions(tenantId: string) {
    const bots = await this.prisma.bot.findMany({
      where: { tenantId },
      select: { id: true, name: true, config: true },
    });
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const out: any[] = [];
    for (const b of bots) {
      const list: any[] = Array.isArray((b.config as any)?.manualGroups) ? (b.config as any).manualGroups : [];
      for (const g of list) {
        const until = g.validUntil ? new Date(g.validUntil).getTime() : null;
        let state: 'active' | 'expiring' | 'expired' | 'none' = 'none';
        let daysLeft: number | null = null;
        if (until) {
          daysLeft = Math.ceil((until - now) / DAY);
          state = until < now ? 'expired' : daysLeft <= 7 ? 'expiring' : 'active';
        }
        out.push({
          botId: b.id,
          botName: b.name,
          id: g.id,
          name: g.name || g.id,
          plan: g.plan || null,
          validUntil: g.validUntil || null,
          state,
          daysLeft,
        });
      }
    }
    // Expiring/expired first, then by days left.
    const rank = { expiring: 0, expired: 1, active: 2, none: 3 } as any;
    out.sort((a, b) => (rank[a.state] - rank[b.state]) || ((a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)));
    return out;
  }

  /** Extend a group's subscription validity by N months (renewal). */
  async renewGroup(tenantId: string, id: string, groupId: string, months: number) {
    const bot = await this.get(tenantId, id);
    const cfg: any = (bot.config as any) || {};
    const list: any[] = Array.isArray(cfg.manualGroups) ? cfg.manualGroups : [];
    const g = list.find((x) => String(x.id) === String(groupId));
    if (!g) throw new BadRequestException('Grupo não encontrado');
    // Extend from the later of now / current expiry.
    const base = g.validUntil && new Date(g.validUntil).getTime() > Date.now() ? new Date(g.validUntil) : new Date();
    base.setMonth(base.getMonth() + (months || 1));
    g.validUntil = base.toISOString().slice(0, 10);
    cfg.manualGroups = list;
    await this.prisma.bot.update({ where: { id }, data: { config: cfg } });
    return { success: true, validUntil: g.validUntil };
  }

  /** Register or update a group manually (by WhatsApp id) with plan/validity. */
  async addGroup(
    tenantId: string,
    id: string,
    data: { id: string; name?: string; description?: string; plan?: string; validUntil?: string; admins?: string[]; services?: string[] },
  ) {
    const bot = await this.get(tenantId, id);
    if (!data?.id) throw new BadRequestException('Indica o ID do grupo');
    const cfg: any = (bot.config as any) || {};
    const list: any[] = Array.isArray(cfg.manualGroups) ? cfg.manualGroups : [];
    const gid = String(data.id).trim();
    const entry = {
      id: gid,
      name: data.name || '',
      description: data.description || '',
      plan: data.plan || '',
      validUntil: data.validUntil || '',
      admins: Array.isArray(data.admins) ? data.admins : [],
      services: Array.isArray(data.services) ? data.services : [],
    };
    const idx = list.findIndex((g) => String(g.id) === gid);
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.push(entry);
    cfg.manualGroups = list;
    await this.prisma.bot.update({ where: { id }, data: { config: cfg } });
    return { success: true };
  }

  /**
   * Daily scan of group subscriptions: warn the reseller (panel + email) when a
   * group is expiring within 3 days or already expired. Deduped per group/day.
   */
  @Cron('0 9 * * *')
  async checkGroupExpiries() {
    let bots: any[] = [];
    try {
      bots = await this.prisma.bot.findMany({ select: { id: true, name: true, tenantId: true, config: true } });
    } catch {
      return;
    }
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date().toISOString().slice(0, 10);
    const perTenant = new Map<string, string[]>();

    for (const b of bots) {
      const list: any[] = Array.isArray((b.config as any)?.manualGroups) ? (b.config as any).manualGroups : [];
      for (const g of list) {
        if (!g.validUntil) continue;
        const daysLeft = Math.ceil((new Date(g.validUntil).getTime() - now) / DAY);
        if (daysLeft > 3) continue; // only warn within 3 days / expired
        const dedupe = `groupexp:${b.id}:${g.id}:${today}`;
        const seen = await this.redis.get(dedupe).catch(() => null);
        if (seen) continue;
        await this.redis.set(dedupe, '1', 'EX', 60 * 60 * 26).catch(() => null);
        const msg =
          daysLeft < 0
            ? `A assinatura do grupo "${g.name || g.id}" (bot ${b.name}) expirou.`
            : `A assinatura do grupo "${g.name || g.id}" (bot ${b.name}) expira em ${daysLeft} dia(s).`;
        await this.notifications.create(b.tenantId, daysLeft < 0 ? 'error' : 'warning', 'Assinatura de grupo', msg).catch(() => null);
        const arr = perTenant.get(b.tenantId) || [];
        arr.push(msg);
        perTenant.set(b.tenantId, arr);
      }
    }

    // One summary email per tenant.
    for (const [tenantId, msgs] of perTenant) {
      const to = await this.mail.tenantAdminEmail(tenantId).catch(() => undefined);
      if (!to) continue;
      await this.mail
        .send(to, 'Assinaturas de grupos a expirar', `<p>Atenção às seguintes assinaturas:</p><ul>${msgs.map((m) => `<li>${m}</li>`).join('')}</ul><p>Renova em <b>Grupos</b> no painel.</p>`)
        .catch(() => null);
    }
  }

  /** Notify the tenant (panel + email) that a bot is down — deduped in Redis. */
  private async alertBotDown(bot: any) {
    const flag = `bot:${bot.id}:alerted`;
    const already = await this.redis.get(flag).catch(() => null);
    if (already) return;
    await this.redis.set(flag, '1', 'EX', 60 * 60 * 6).catch(() => null); // re-alert at most every 6h
    await this.notifications
      .create(bot.tenantId, 'error', 'Bot em baixo', `O bot "${bot.name}" caiu e não reiniciou automaticamente. Verifica os logs.`)
      .catch(() => null);
    const to = await this.mail.tenantAdminEmail(bot.tenantId).catch(() => undefined);
    await this.mail
      .send(to, `⚠️ Bot em baixo: ${bot.name}`, `<p>O bot <b>${bot.name}</b> caiu e esgotou os reinícios automáticos.</p><p>Entra no painel para ver os logs e reiniciar.</p>`)
      .catch(() => null);
  }

  /**
   * Broadcast a message to the tenant's customers (phone numbers from past
   * transactions) via the running bot. Publishes to bot:{id}:broadcast; the
   * bot sends them with throttling.
   */
  async broadcast(tenantId: string, id: string, message: string, audience: 'all' | 'recent30') {
    await this.get(tenantId, id);
    const msg = (message || '').trim();
    if (!msg) throw new BadRequestException('Mensagem vazia');
    const where: any = { tenantId };
    if (audience === 'recent30') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      where.createdAt = { gte: since };
    }
    const rows = await this.prisma.transaction.findMany({ where, select: { phoneNumber: true }, take: 20000 });
    const numbers = [...new Set(rows.map((r) => r.phoneNumber).filter(Boolean))];
    if (numbers.length === 0) return { success: false, message: 'Sem clientes para enviar.' };
    try {
      await this.redis.publish(`bot:${id}:broadcast`, JSON.stringify({ message: msg, numbers }));
      await this.redis.rpush(`bot:${id}:logs`, `📣 Broadcast enviado ao bot para ${numbers.length} cliente(s).`);
      await this.redis.ltrim(`bot:${id}:logs`, -800, -1);
      return { success: true, count: numbers.length };
    } catch {
      return { success: false, message: 'Redis indisponível — o bot precisa de estar a correr.' };
    }
  }

  /** Ask the running bot to scan its WhatsApp groups now and report back. */
  async requestSync(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      await this.redis.publish(`bot:${id}:sync`, Date.now().toString());
      await this.redis.rpush(`bot:${id}:logs`, '🔄 Varredura de grupos pedida ao bot…');
      await this.redis.ltrim(`bot:${id}:logs`, -800, -1);
      return { success: true };
    } catch {
      return { success: false, message: 'Redis indisponível — o bot precisa de estar a correr.' };
    }
  }

  async removeGroup(tenantId: string, id: string, groupId: string) {
    const bot = await this.get(tenantId, id);
    const cfg: any = (bot.config as any) || {};
    cfg.manualGroups = (Array.isArray(cfg.manualGroups) ? cfg.manualGroups : []).filter((g: any) => String(g.id) !== String(groupId));
    await this.prisma.bot.update({ where: { id }, data: { config: cfg } });
    return { success: true };
  }

  /** A ready-to-use Baileys bot template that already reports groups & syncs. */
  private templateFiles(): { name: string; content: string }[] {
    const pkg = JSON.stringify(
      {
        name: 'hostagente-bot',
        version: '1.0.0',
        main: 'index.js',
        scripts: { start: 'node index.js' },
        dependencies: {
          '@whiskeysockets/baileys': '^6.7.0',
          ioredis: '^5.3.2',
          'qrcode-terminal': '^0.12.0',
        },
      },
      null,
      2,
    );
    const index = `const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { startReporting } = require('./hostagente-report');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') {
      console.log('✅ Ligado ao WhatsApp!');
      // Reporta os grupos ao painel HostAgente (usa as env do container).
      startReporting(sock, {});
    }
    if (connection === 'close') {
      const reconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada. Reconectar:', reconnect);
      if (reconnect) start();
    }
  });

  // Handler de mensagens (defensivo: nunca faz .trim() de null).
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages && messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) ||
      '';
    const cmd = String(text || '').trim().toLowerCase();
    if (cmd === '.ping') await sock.sendMessage(jid, { text: 'pong 🏓' });
    if (cmd === '.sincronizar') {
      await startReporting(sock, {});
      await sock.sendMessage(jid, { text: 'Grupos sincronizados com o painel ✅' });
    }
  });
}

start();
`;
    // Reuse the reporter helper (kept in sync with examples/hostagente-report.js).
    const reporter = `const fs = require('fs');
const path = require('path');
const API_URL = process.env.PAINEL_API_URL || process.env.HOSTAGENTE_URL || 'http://api:3000';
const API_KEY = process.env.PAINEL_API_KEY || process.env.HOSTAGENTE_KEY || '';
const BOT_ID = process.env.PAINEL_BOT_ID || process.env.BOT_ID || '';

function detectServices(dir = path.join(process.cwd(), 'src', 'comandos')) {
  try { return fs.readdirSync(dir).filter((f) => /\\.(js|mjs|cjs)$/.test(f)).map((f) => f.replace(/\\.(js|mjs|cjs)$/, '')); }
  catch { return []; }
}

async function reportGroups(sock, opts = {}) {
  if (!API_KEY || !BOT_ID) { console.log('[HostAgente] Falta PAINEL_API_KEY/BOT_ID.'); return; }
  const services = opts.services && opts.services.length ? opts.services : detectServices();
  const subs = opts.subscriptions || {};
  const metaMap = await sock.groupFetchAllParticipating();
  const groups = Object.values(metaMap).map((meta) => {
    const admins = (meta.participants || []).filter((p) => p.admin).map((p) => '+' + String(p.id).split('@')[0]);
    const sub = subs[meta.id] || {};
    return { id: meta.id, name: meta.subject || 'Grupo', description: meta.desc || '', admins, services, participants: (meta.participants || []).length, plan: sub.plan, active: sub.active !== false };
  });
  const res = await fetch(API_URL + '/bot-api/bots/' + BOT_ID + '/groups', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify({ groups }),
  });
  console.log('[HostAgente] Reportei', groups.length, 'grupo(s):', await res.json().catch(() => ({})));
}

function startReporting(sock, opts = {}, intervalMs = 5 * 60 * 1000) {
  const run = () => reportGroups(sock, opts).catch((e) => console.log('[HostAgente]', e.message));
  run();
  const timer = setInterval(run, intervalMs);
  try {
    const Redis = require('ioredis');
    const sub = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
    sub.on('error', () => {});
    sub.subscribe('bot:' + BOT_ID + ':sync', 'bot:' + BOT_ID + ':broadcast').catch(() => {});
    sub.on('message', async (channel, payload) => {
      if (channel.endsWith(':sync')) return run();
      if (channel.endsWith(':broadcast')) {
        try {
          const data = JSON.parse(payload);
          for (const n of data.numbers) {
            const jid = String(n).replace(/\\D/g, '') + '@s.whatsapp.net';
            try { await sock.sendMessage(jid, { text: data.message }); } catch {}
            await new Promise((r) => setTimeout(r, 3000));
          }
        } catch {}
      }
    });
  } catch {}
  return timer;
}

module.exports = { startReporting, reportGroups, detectServices };
`;
    const readme = `# Bot-modelo HostAgente

Bot Baileys pronto que já reporta os grupos ao painel.

## Como usar
1. Cria um bot manual no painel HostAgente.
2. Carrega este projeto (ZIP) na página do bot.
3. Clica em **Iniciar**. Lê o QR code na consola do painel.
4. Os grupos aparecem no painel automaticamente (e em \`.sincronizar\`).

As credenciais (PAINEL_API_URL/KEY/BOT_ID) são injetadas pelo painel — não precisas de configurar nada.

## Comandos
- \`.ping\` → pong
- \`.sincronizar\` → força o envio dos grupos ao painel

Adiciona os teus comandos em \`src/comandos/\`.
`;
    return [
      { name: 'package.json', content: pkg },
      { name: 'index.js', content: index },
      { name: 'hostagente-report.js', content: reporter },
      { name: 'README.md', content: readme },
      { name: 'src/comandos/.gitkeep', content: '' },
    ];
  }

  async downloadTemplate(res: any) {
    await this.zipFiles(res, 'bot-modelo-hostagente.zip', this.templateFiles());
  }

  /** Ready-to-run payment bridge (WhatsApp -> /ingest/macrodroid). */
  async downloadBridge(res: any) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bridgeTemplateFiles } = require('./bridge-template');
    await this.zipFiles(res, 'ponte-pagamentos.zip', bridgeTemplateFiles());
  }

  private async zipFiles(res: any, filename: string, files: { name: string; content: string }[]) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const archiver = require('archiver');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', () => {
      try {
        res.status(500).end();
      } catch {
        /* ignore */
      }
    });
    archive.pipe(res);
    for (const f of files) archive.append(f.content, { name: f.name });
    await archive.finalize();
  }

  /** Stream the bot's project folder as a .zip download (excludes node_modules/.git). */
  async downloadProject(tenantId: string, id: string, res: any) {
    await this.get(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const archiver = require('archiver');
    const dir = path.join(PROJECTS_DIR, id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="bot-${id}.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', () => {
      try {
        res.status(500).end();
      } catch {
        /* ignore */
      }
    });
    archive.pipe(res);
    archive.glob('**/*', { cwd: dir, ignore: ['node_modules/**', '.git/**'], dot: true });
    await archive.finalize();
  }

  /** Clear the bot's terminal log buffer (server-side, so it stays cleared). */
  async clearLogs(tenantId: string, id: string) {
    await this.get(tenantId, id);
    try {
      await this.redis.del(`bot:${id}:logs`);
    } catch {
      /* ignore */
    }
    return { success: true };
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
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'project.zip'), buffer);
    } catch (err: any) {
      this.logger.error(`saveProjectZip ${id}: ${err?.message}`);
      throw new BadRequestException(
        `Não foi possível guardar o ficheiro em ${dir}: ${err?.code || err?.message}. ` +
          `Confirma que a pasta de projetos (PROJECTS_DIR) está montada e com permissão de escrita.`,
      );
    }
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
    const skip = new Set(['node_modules', '.git', '.history']);
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

  // Keep timestamped backups of a file before overwriting, so updates can be
  // reverted. Stored under .history/<rel>/<timestamp> (max 10 per file).
  private historyDir(id: string, rel: string) {
    return this.safe(id, path.posix.join('.history', rel));
  }
  private async backupFile(id: string, rel: string) {
    if (rel.startsWith('.history')) return;
    const p = this.safe(id, rel);
    try {
      const stat = await fs.stat(p);
      if (!stat.isFile() || stat.size > 1024 * 1024) return;
      const dir = this.historyDir(id, rel);
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(p, path.join(dir, String(Date.now())));
      const entries = (await fs.readdir(dir)).sort();
      for (const old of entries.slice(0, Math.max(0, entries.length - 10))) {
        await fs.rm(path.join(dir, old), { force: true }).catch(() => null);
      }
    } catch {
      /* no existing file to back up */
    }
  }

  async writeFileContent(tenantId: string, id: string, rel: string, content: string) {
    await this.get(tenantId, id);
    const p = this.safe(id, rel);
    await this.backupFile(id, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content ?? '', 'utf8');
    await this.prisma.bot.update({ where: { id }, data: { hasScript: true } }).catch(() => null);
    return { success: true };
  }

  /** List backup versions of a file (newest first). */
  async fileHistory(tenantId: string, id: string, rel: string) {
    await this.get(tenantId, id);
    const dir = this.historyDir(id, rel);
    try {
      const entries = await fs.readdir(dir);
      return entries
        .map((ts) => ({ version: ts, at: new Date(Number(ts)).toISOString() }))
        .sort((a, b) => Number(b.version) - Number(a.version));
    } catch {
      return [];
    }
  }

  /** Restore a file to a previous version (backs up the current one first). */
  async revertFile(tenantId: string, id: string, rel: string, version: string) {
    await this.get(tenantId, id);
    const dir = this.historyDir(id, rel);
    const src = path.join(dir, path.basename(version));
    if (!src.startsWith(dir)) throw new BadRequestException('Versão inválida');
    let content: Buffer;
    try {
      content = await fs.readFile(src);
    } catch {
      throw new BadRequestException('Versão não encontrada');
    }
    await this.backupFile(id, rel); // preserve current before reverting
    const p = this.safe(id, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content);
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
    try {
      for (const f of files) {
        if (!f.rel) continue;
        const p = this.safe(id, f.rel);
        await this.backupFile(id, f.rel); // keep previous version for revert
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, f.buffer);
        count++;
      }
    } catch (err: any) {
      this.logger.error(`saveFiles ${id}: ${err?.message}`);
      throw new BadRequestException(
        `Falha ao guardar ficheiros: ${err?.code || err?.message}. ` +
          `Confirma que a pasta de projetos está montada e com permissão de escrita.`,
      );
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
