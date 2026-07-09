/**
 * HostAgente — reporter de grupos para bots Baileys.
 *
 * Copia este ficheiro para o teu projeto de bot e chama `startReporting(sock)`
 * depois de o socket Baileys ligar. Ele:
 *   1. lê TODOS os grupos onde o bot está (nome, descrição, admins, nº de membros);
 *   2. deteta os "serviços ativos" (comandos) estudando a pasta de comandos do
 *      teu projeto — ou usa o mapa que passares;
 *   3. calcula o plano e o estado da assinatura de cada grupo (a partir do teu
 *      próprio armazenamento) e SÓ marca como ativo os grupos com assinatura em pé;
 *   4. envia tudo para o painel HostAgente via API key.
 *
 * Variáveis de ambiente (já injetadas pelo container do bot):
 *   BOT_ID          — id do bot na plataforma
 *   HOSTAGENTE_URL  — ex: http://185.27.135.66:3000   (define no teu projeto)
 *   HOSTAGENTE_KEY  — a tua API key do tenant (Conta & API no painel)
 */
const fs = require('fs');
const path = require('path');

const API_URL = process.env.HOSTAGENTE_URL || 'http://localhost:3000';
const API_KEY = process.env.HOSTAGENTE_KEY || '';
const BOT_ID = process.env.BOT_ID || '';

/**
 * Estuda os scripts do bot: lê os nomes dos ficheiros da pasta de comandos e
 * usa-os como lista de "serviços" que o bot oferece. Ajusta `dir` à tua estrutura.
 */
function detectServices(dir = path.join(process.cwd(), 'src', 'comandos')) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(js|mjs|cjs)$/.test(f))
      .map((f) => f.replace(/\.(js|mjs|cjs)$/, ''));
  } catch {
    return [];
  }
}

/**
 * @param sock  socket Baileys já ligado
 * @param opts.services        array de serviços (senão são detetados dos scripts)
 * @param opts.subscriptions   { [groupJid]: { plan: 'PRO', active: true } }
 */
async function reportGroups(sock, opts = {}) {
  if (!API_KEY || !BOT_ID) {
    console.log('[HostAgente] HOSTAGENTE_KEY/BOT_ID em falta — não reporto grupos.');
    return;
  }
  const services = opts.services && opts.services.length ? opts.services : detectServices();
  const subs = opts.subscriptions || {};

  // Todos os grupos onde o bot participa.
  const metaMap = await sock.groupFetchAllParticipating();
  const groups = Object.values(metaMap).map((meta) => {
    const admins = (meta.participants || [])
      .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
      .map((p) => '+' + String(p.id).split('@')[0]);
    const sub = subs[meta.id] || {};
    return {
      name: meta.subject || 'Grupo',
      description: meta.desc || '',
      admins,
      services, // serviços ativos que o bot oferece nesse grupo
      participants: (meta.participants || []).length,
      plan: sub.plan, // ex: 'PRO' (do teu armazenamento)
      active: sub.active !== false, // só serve grupos com assinatura em pé
    };
  });

  // Envia para o painel.
  const res = await fetch(`${API_URL}/bot-api/bots/${BOT_ID}/groups`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ groups }),
  });
  const out = await res.json().catch(() => ({}));
  console.log(`[HostAgente] Reportei ${groups.length} grupo(s):`, out);
}

/**
 * Reporta agora, a cada `intervalMs` (default 5 min) E também sob demanda:
 * quando clicas em "Varrer grupos" no painel (ou adicionas um grupo pelo ID),
 * o painel publica no canal Redis `bot:<BOT_ID>:sync` e o bot varre logo.
 * A subscrição do Redis é opcional (só ativa se o pacote `ioredis` existir).
 */
function startReporting(sock, opts = {}, intervalMs = 5 * 60 * 1000) {
  const run = () => reportGroups(sock, opts).catch((e) => console.log('[HostAgente]', e.message));
  run();
  const timer = setInterval(run, intervalMs);

  // Varredura sob demanda via Redis (o container já tem REDIS_URL).
  try {
    // eslint-disable-next-line global-require
    const Redis = require('ioredis');
    const sub = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
    sub.on('error', () => {});
    sub.subscribe(`bot:${BOT_ID}:sync`).catch(() => {});
    sub.on('message', () => {
      console.log('[HostAgente] Varredura pedida pelo painel — a reportar grupos…');
      run();
    });
  } catch {
    console.log('[HostAgente] ioredis não instalado — varredura sob demanda desativada (usa só o intervalo).');
  }
  return timer;
}

module.exports = { startReporting, reportGroups, detectServices };
