/**
 * Ponte WhatsApp -> HostAgente
 *
 * Fica ligado a um número de WhatsApp, lê os comprovantes de pagamento
 * (M-Pesa / e-Mola) reencaminhados pelos clientes, extrai valor, referência e
 * número, consulta a tabela de preços e envia ao endpoint /ingest/macrodroid.
 *
 * Ver README.md para instalação e configuração.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const PROCESSED_PATH = path.join(__dirname, 'processed.json');
const API_KEY = process.env.API_KEY || '';

// ── Config (recarregada a cada mensagem, para editar preços sem reiniciar) ──
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Erro a ler config.json:', e.message);
    return { pricing: {}, bufferMs: 8000, ownAccountNumbers: [], endpoint: '' };
  }
}

// ── Registo de referências já processadas (evita duplicados) ──
function loadProcessed() {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf8')));
  } catch {
    return new Set();
  }
}
function saveProcessed(set) {
  try {
    fs.writeFileSync(PROCESSED_PATH, JSON.stringify([...set], null, 2));
  } catch (e) {
    console.error('Erro a guardar processed.json:', e.message);
  }
}
const processed = loadProcessed();

// ── Parsing dos comprovantes ──
function normalizeNumber(n) {
  const digits = String(n).replace(/\D/g, '');
  if (digits.length === 9 && digits[0] === '8') return '258' + digits;
  if (digits.length === 12 && digits.startsWith('258')) return digits;
  return digits;
}

// Deteta a operadora pelo texto.
function detectOperator(text) {
  const t = text.toLowerCase();
  if (t.includes('e-mola') || t.includes('emola')) return 'emola';
  if (t.includes('mkesh') || t.includes('m-kesh')) return 'mkesh';
  if (t.includes('m-pesa') || t.includes('mpesa') || t.includes('confirmado')) return 'mpesa';
  return null;
}

// Extrai o valor pago (em MT).
function extractAmount(text) {
  // Ex.: "50.00MT", "50,00 MT", "MT50", "recebeste 50,00MT"
  const m = text.match(/(\d[\d\s.,]*)\s*mt/i) || text.match(/mt\s*(\d[\d.,]*)/i);
  if (!m) return null;
  const raw = m[1].replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const val = parseFloat(raw);
  return Number.isFinite(val) ? Math.round(val) : null;
}

// Extrai a referência da transação (código do comprovante).
function extractReference(text) {
  // M-Pesa: "Confirmado CI123ABC45." | e-Mola: "ID da transacao: PP2..."
  const m =
    text.match(/confirmad[oa]\s+([A-Z0-9.]{6,20})/i) ||
    text.match(/transac[aã]o[:\s]+([A-Z0-9.]{6,20})/i) ||
    text.match(/\bID[:\s]+([A-Z0-9.]{6,20})/i) ||
    text.match(/\b([A-Z]{2}[A-Z0-9]{6,16})\b/);
  return m ? m[1].replace(/\.$/, '') : null;
}

// Encontra um número moçambicano no texto que não seja a nossa própria conta.
function extractClientNumber(text, ownNumbers) {
  const own = new Set((ownNumbers || []).map(normalizeNumber));
  const matches = text.match(/\b8[2-7]\d{7}\b/g) || [];
  for (const m of matches) {
    const n = normalizeNumber(m);
    if (!own.has(n)) return n;
  }
  return null;
}

// ── Buffer por remetente (junta mensagens seguidas) ──
const buffers = new Map(); // jid -> { texts: [], timer }

async function processBuffered(sock, jid) {
  const entry = buffers.get(jid);
  if (!entry) return;
  buffers.delete(jid);
  const text = entry.texts.join('\n');
  await handlePayment(sock, jid, text);
}

async function handlePayment(sock, jid, text) {
  const config = loadConfig();
  const operator = detectOperator(text);
  if (!operator) return; // não é um comprovante

  const amount = extractAmount(text);
  const reference = extractReference(text);
  const senderNumber = normalizeNumber(jid.split('@')[0]);
  const clientNumber = extractClientNumber(text, config.ownAccountNumbers) || senderNumber;

  console.log(`[bridge] ${operator} | valor=${amount} | ref=${reference} | cliente=${clientNumber}`);

  if (!amount) {
    await reply(sock, jid, '⚠️ Não consegui ler o valor do comprovante. Reenvia a mensagem completa, por favor.');
    return;
  }

  // Duplicado?
  if (reference && processed.has(reference)) {
    await reply(sock, jid, 'ℹ️ Este comprovante já foi processado anteriormente.');
    return;
  }

  const mb = config.pricing ? config.pricing[String(amount)] : undefined;

  // Valor não está na tabela -> confirmação manual.
  if (mb === undefined) {
    await reply(
      sock,
      jid,
      `⏳ Recebemos ${amount} MT mas este valor precisa de confirmação manual. Vamos verificar e enviar em breve.`,
    );
    if (config.adminNumber) {
      await notify(
        sock,
        config.adminNumber,
        `🔔 Pagamento de ${amount} MT (${operator}) sem pacote na tabela.\nCliente: ${clientNumber}\nRef: ${reference || '—'}\n\n${text}`,
      );
    }
    return;
  }

  // Envia ao HostAgente.
  try {
    await axios.post(
      config.endpoint,
      { phone: clientNumber, amount, operator, reference: reference || undefined, raw: text },
      { headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' }, timeout: 15000 },
    );
    if (reference) {
      processed.add(reference);
      saveProcessed(processed);
    }
    await reply(sock, jid, `✅ Pagamento de ${amount} MT confirmado! ${mb} MB a caminho de ${clientNumber}. Obrigado!`);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[bridge] Falha ao enviar ao endpoint:', msg);
    await reply(sock, jid, '⚠️ Recebemos o comprovante mas houve um erro ao processar. Vamos verificar manualmente.');
    if (config.adminNumber) {
      await notify(sock, config.adminNumber, `❌ Erro ao processar ${amount} MT de ${clientNumber}: ${msg}\n\n${text}`);
    }
  }
}

async function reply(sock, jid, text) {
  try {
    await sock.sendMessage(jid, { text });
  } catch (e) {
    console.error('[bridge] erro ao responder:', e.message);
  }
}
async function notify(sock, number, text) {
  try {
    await sock.sendMessage(normalizeNumber(number) + '@s.whatsapp.net', { text });
  } catch (e) {
    console.error('[bridge] erro ao notificar admin:', e.message);
  }
}

// ── Ligação ao WhatsApp ──
async function start() {
  if (!API_KEY) {
    console.error('API_KEY em falta. Copia .env.example para .env e cola a tua chave.');
    process.exit(1);
  }
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info'));
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      console.log('\nEscaneia este QR no WhatsApp (Aparelhos conectados):\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('✅ Ponte ligada ao WhatsApp. À espera de comprovantes…');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reconnect = code !== DisconnectReason.loggedOut;
      console.log('Conexão fechada.', reconnect ? 'A reconectar…' : 'Sessão terminada (novo QR necessário).');
      if (reconnect) setTimeout(start, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue; // só conversas diretas
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';
      if (!text.trim()) continue;

      // Junta mensagens seguidas do mesmo remetente durante bufferMs.
      const config = loadConfig();
      const entry = buffers.get(jid) || { texts: [], timer: null };
      entry.texts.push(text);
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => processBuffered(sock, jid), config.bufferMs || 8000);
      buffers.set(jid, entry);
    }
  });
}

start().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
