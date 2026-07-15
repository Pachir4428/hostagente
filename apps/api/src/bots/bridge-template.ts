// Ficheiros da "Ponte de pagamentos" (WhatsApp -> /ingest/macrodroid),
// embutidos para download 1-clique. Corre como bot manual na plataforma: a
// PAINEL_API_KEY e o PAINEL_API_URL são injetados, por isso NÃO precisa de .env.

const PACKAGE_JSON = JSON.stringify(
  {
    name: 'ponte-pagamentos',
    version: '1.0.0',
    main: 'index.js',
    scripts: { start: 'node index.js' },
    dependencies: {
      '@whiskeysockets/baileys': '^6.7.0',
      axios: '^1.6.5',
      ioredis: '^5.3.2',
      pino: '^8.17.2',
      'qrcode-terminal': '^0.12.0',
    },
  },
  null,
  2,
);

const CONFIG_JSON = JSON.stringify(
  {
    bufferMs: 8000,
    adminNumber: '',
    ownAccountNumbers: [],
    pricing: { '10': 100, '20': 250, '24': 300, '50': 600, '100': 1300, '180': 2400 },
  },
  null,
  2,
);

const INDEX_JS = String.raw`/**
 * Ponte de pagamentos WhatsApp -> HostAgente.
 * Corre como bot manual na plataforma: usa a chave e o URL injetados
 * (PAINEL_API_KEY / PAINEL_API_URL). Não precisa de .env.
 * Edita a tabela de preços e o adminNumber no config.json.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const API_KEY = process.env.PAINEL_API_KEY || process.env.HOSTAGENTE_KEY || process.env.API_KEY || '';
const PANEL_URL = process.env.PAINEL_API_URL || process.env.HOSTAGENTE_URL || 'http://api:3000';
const BID = process.env.BOT_ID || process.env.PAINEL_BOT_ID || '';
let rq; try { const R = require('ioredis'); rq = new R(process.env.REDIS_URL || 'redis://redis:6379'); rq.on('error', () => {}); } catch { rq = { set: () => Promise.resolve(), del: () => Promise.resolve() }; }
const CONFIG_PATH = path.join(__dirname, 'config.json');
const PROCESSED_PATH = path.join(__dirname, 'processed.json');

function loadConfig() {
  try { const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); c.endpoint = PANEL_URL.replace(/\/$/, '') + '/ingest/macrodroid'; return c; }
  catch { return { pricing: {}, bufferMs: 8000, ownAccountNumbers: [], endpoint: PANEL_URL + '/ingest/macrodroid' }; }
}
function loadProcessed() { try { return new Set(JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf8'))); } catch { return new Set(); } }
function saveProcessed(s) { try { fs.writeFileSync(PROCESSED_PATH, JSON.stringify([...s], null, 2)); } catch {} }
const processed = loadProcessed();

function normalizeNumber(n) { const d = String(n).replace(/\D/g, ''); if (d.length === 9 && d[0] === '8') return '258' + d; if (d.length === 12 && d.startsWith('258')) return d; return d; }
function detectOperator(t) { t = t.toLowerCase(); if (t.includes('e-mola') || t.includes('emola')) return 'emola'; if (t.includes('mkesh')) return 'mkesh'; if (t.includes('m-pesa') || t.includes('mpesa') || t.includes('confirmado')) return 'mpesa'; return null; }
function extractAmount(t) { const m = t.match(/(\d[\d\s.,]*)\s*mt/i) || t.match(/mt\s*(\d[\d.,]*)/i); if (!m) return null; const v = parseFloat(m[1].replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(v) ? Math.round(v) : null; }
function extractReference(t) { const m = t.match(/confirmad[oa]\s+([A-Z0-9.]{6,20})/i) || t.match(/transac[aã]o[:\s]+([A-Z0-9.]{6,20})/i) || t.match(/\bID[:\s]+([A-Z0-9.]{6,20})/i) || t.match(/\b([A-Z]{2}[A-Z0-9]{6,16})\b/); return m ? m[1].replace(/\.$/, '') : null; }
function extractClientNumber(t, own) { const set = new Set((own || []).map(normalizeNumber)); const ms = t.match(/\b8[2-7]\d{7}\b/g) || []; for (const m of ms) { const n = normalizeNumber(m); if (!set.has(n)) return n; } return null; }

const buffers = new Map();
async function reply(sock, jid, text) { try { await sock.sendMessage(jid, { text }); } catch {} }
async function notify(sock, num, text) { try { await sock.sendMessage(normalizeNumber(num) + '@s.whatsapp.net', { text }); } catch {} }

async function handlePayment(sock, jid, text) {
  const config = loadConfig();
  const operator = detectOperator(text);
  if (!operator) return;
  const amount = extractAmount(text);
  const reference = extractReference(text);
  const sender = normalizeNumber(jid.split('@')[0]);
  const client = extractClientNumber(text, config.ownAccountNumbers) || sender;
  console.log('[ponte] ' + operator + ' valor=' + amount + ' ref=' + reference + ' cliente=' + client);
  if (!amount) return reply(sock, jid, '⚠️ Não consegui ler o valor. Reenvia o comprovante completo.');
  if (reference && processed.has(reference)) return reply(sock, jid, 'ℹ️ Este comprovante já foi processado.');
  const mb = config.pricing ? config.pricing[String(amount)] : undefined;
  if (mb === undefined) {
    await reply(sock, jid, '⏳ Recebemos ' + amount + ' MT. Este valor precisa de confirmação manual, aguarda.');
    if (config.adminNumber) await notify(sock, config.adminNumber, '🔔 ' + amount + ' MT (' + operator + ') sem pacote.\nCliente: ' + client + '\nRef: ' + (reference || '-') + '\n\n' + text);
    return;
  }
  try {
    await axios.post(config.endpoint, { phone: client, amount, operator, reference: reference || undefined, raw: text }, { headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' }, timeout: 15000 });
    if (reference) { processed.add(reference); saveProcessed(processed); }
    await reply(sock, jid, '✅ Pagamento de ' + amount + ' MT confirmado! ' + mb + ' MB para ' + client + '. Obrigado!');
  } catch (e) {
    const msg = (e.response && e.response.data && e.response.data.message) || e.message;
    console.error('[ponte] erro endpoint:', msg);
    await reply(sock, jid, '⚠️ Recebemos o comprovante mas houve um erro. Vamos verificar manualmente.');
    if (config.adminNumber) await notify(sock, config.adminNumber, '❌ Erro ' + amount + ' MT de ' + client + ': ' + msg + '\n\n' + text);
  }
}

async function start() {
  if (!API_KEY) { console.error('Sem chave de API. Este bot deve correr dentro do painel HostAgente.'); }
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info'));
  const sock = makeWASocket({ auth: state, printQRInTerminal: false, logger: pino({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) { console.log('\nEscaneia este QR no WhatsApp (Aparelhos conectados):\n'); qrcode.generate(qr, { small: true }); if (BID) rq.set('bot:' + BID + ':qr', qr, 'EX', 90).catch(() => {}); }
    if (connection === 'open') { console.log('✅ Ponte ligada. À espera de comprovantes…'); if (BID) rq.del('bot:' + BID + ':qr').catch(() => {}); }
    if (connection === 'close') { const reconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; if (reconnect) setTimeout(start, 3000); }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue;
      const text = msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || (msg.message.imageMessage && msg.message.imageMessage.caption) || '';
      if (!text.trim()) continue;
      const config = loadConfig();
      const entry = buffers.get(jid) || { texts: [], timer: null };
      entry.texts.push(text);
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => { const e = buffers.get(jid); buffers.delete(jid); if (e) handlePayment(sock, jid, e.texts.join('\n')); }, config.bufferMs || 8000);
      buffers.set(jid, entry);
    }
  });
}
start().catch((e) => { console.error('Erro fatal:', e); process.exit(1); });
`;

const README = `# Ponte de pagamentos (WhatsApp -> HostAgente)

Bot que lê comprovantes M-Pesa/eMola no WhatsApp e regista as vendas no painel.

## Como usar (dentro do painel)
1. Cria um bot manual e carrega este ZIP.
2. Clica em **Iniciar** e lê o QR code na consola.
3. Pronto! A chave e o URL são injetados automaticamente — não precisas de .env.

Edita a tabela de precos e o teu numero de admin no **config.json**
(via o gestor de ficheiros do painel). Recarregado a cada mensagem.
`;

export function bridgeTemplateFiles(): { name: string; content: string }[] {
  return [
    { name: 'package.json', content: PACKAGE_JSON },
    { name: 'index.js', content: INDEX_JS },
    { name: 'config.json', content: CONFIG_JSON },
    { name: 'README.md', content: README },
  ];
}
