/**
 * HostAgente Baileys bot engine — one container per manual bot.
 *
 * Connects to WhatsApp via Baileys, publishes QR / pairing code / status /
 * logs to Redis (read by the API for the bot console), and runs the tenant's
 * uploaded script (/data/scripts/{BOT_ID}/bot.js) if present.
 *
 * Env: BOT_ID, REDIS_URL, PHONE (optional, for pairing-code login).
 */
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const Redis = require('ioredis');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const BOT_ID = process.env.BOT_ID;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PHONE = (process.env.PHONE || '').replace(/[^0-9]/g, '');

if (!BOT_ID) {
  console.error('BOT_ID is required');
  process.exit(1);
}

const redis = new Redis(REDIS_URL);
const K = {
  status: `bot:${BOT_ID}:status`,
  qr: `bot:${BOT_ID}:qr`,
  pairing: `bot:${BOT_ID}:pairing`,
  logs: `bot:${BOT_ID}:logs`,
};

async function log(line) {
  const entry = `[${new Date().toISOString()}] ${line}`;
  console.log(entry);
  try {
    await redis.rpush(K.logs, entry);
    await redis.ltrim(K.logs, -200, -1); // keep last 200 lines
    await redis.expire(K.logs, 60 * 60 * 24);
  } catch {
    /* ignore */
  }
}

async function setStatus(status) {
  try {
    await redis.set(K.status, status, 'EX', 60 * 60 * 24);
  } catch {
    /* ignore */
  }
}

const SESSION_DIR = `/data/sessions/${BOT_ID}`;
const SCRIPT_PATH = `/data/scripts/${BOT_ID}/bot.js`;

function loadUserScript() {
  try {
    if (fs.existsSync(SCRIPT_PATH)) {
      // Fresh require each start.
      delete require.cache[require.resolve(SCRIPT_PATH)];
      const mod = require(SCRIPT_PATH);
      if (typeof mod === 'function') return mod;
      if (mod && typeof mod.default === 'function') return mod.default;
      log('Uploaded script has no default export function — ignoring.');
    }
  } catch (err) {
    log(`Failed to load uploaded script: ${err.message}`);
  }
  return null;
}

async function start() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  await setStatus('starting');
  await log('Bot engine a iniciar…');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['HostAgente', 'Chrome', '1.0.0'],
  });

  // Pairing-code login (if a phone number was provided and we're not registered).
  if (PHONE && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE);
        await redis.set(K.pairing, code, 'EX', 300);
        await log(`Código de emparelhamento: ${code}`);
      } catch (err) {
        await log(`Falha ao gerar código de emparelhamento: ${err.message}`);
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      await redis.set(K.qr, qr, 'EX', 120);
      await setStatus('waiting_qr');
      await log('QR code gerado — lê no WhatsApp.');
    }
    if (connection === 'open') {
      await redis.del(K.qr);
      await redis.del(K.pairing);
      await setStatus('connected');
      await log('✅ Ligado ao WhatsApp.');
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      await setStatus(loggedOut ? 'stopped' : 'error');
      await log(`Ligação fechada (${code}).${loggedOut ? ' Sessão terminada.' : ' A reconectar…'}`);
      if (!loggedOut) {
        setTimeout(() => start().catch((e) => log(`Erro a reconectar: ${e.message}`)), 3000);
      }
    }
  });

  // Default + custom message handling.
  const userScript = loadUserScript();
  let config = {};
  try {
    const raw = await redis.get(`bot:${BOT_ID}:config`);
    if (raw) config = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      try {
        if (userScript) {
          await userScript(sock, msg, { config, log });
        } else if (config.welcomeMessage) {
          const jid = msg.key.remoteJid;
          const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
          if (text) await sock.sendMessage(jid, { text: config.welcomeMessage });
        }
      } catch (err) {
        await log(`Erro ao processar mensagem: ${err.message}`);
      }
    }
  });

  if (userScript) await log('Script personalizado carregado.');
  else await log('Sem script personalizado — a usar resposta automática (welcomeMessage).');
}

start().catch(async (err) => {
  await log(`Erro fatal: ${err.message}`);
  await setStatus('error');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await setStatus('stopped');
  await log('Bot engine a encerrar.');
  process.exit(0);
});
