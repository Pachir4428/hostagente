const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Redis = require('ioredis');
const express = require('express');

const BOT_ID = process.env.BOT_ID || 'default-bot';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL);
const redisPub = new Redis(REDIS_URL);

const app = express();
app.use(express.json());

let botStatus = 'starting';
let currentQR = null;

app.get('/health', (req, res) => {
  res.json({ status: botStatus, botId: BOT_ID });
});

app.listen(5000, () => {
  console.log(`Bot engine ${BOT_ID} health endpoint on port 5000`);
});

async function publishStatus(status, extra = {}) {
  botStatus = status;
  const event = JSON.stringify({ botId: BOT_ID, status, timestamp: new Date().toISOString(), ...extra });
  await redisPub.publish('bot:status', event);
  await redis.set(`bot:${BOT_ID}:status`, status);
  console.log(`Bot ${BOT_ID} status: ${status}`);
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: BOT_ID,
    dataPath: `/data/sessions`,
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  },
});

client.on('qr', async (qr) => {
  currentQR = qr;
  qrcode.generate(qr, { small: true });
  await publishStatus('waiting_qr', { qrCode: qr });
  await redisPub.publish(`bot:${BOT_ID}:qr`, JSON.stringify({ botId: BOT_ID, qrCode: qr }));
});

client.on('ready', async () => {
  currentQR = null;
  await publishStatus('running');
  console.log(`Bot ${BOT_ID} is ready`);
});

client.on('authenticated', async () => {
  await publishStatus('authenticated');
});

client.on('auth_failure', async (msg) => {
  await publishStatus('error', { message: msg });
});

client.on('disconnected', async (reason) => {
  await publishStatus('stopped', { reason });
  console.log(`Bot ${BOT_ID} disconnected: ${reason}`);
});

client.on('message', async (message) => {
  const from = message.from;
  const body = message.body;

  console.log(`Message from ${from}: ${body}`);

  // Publish message event for worker processing
  await redisPub.publish('bot:message', JSON.stringify({
    botId: BOT_ID,
    from,
    body,
    timestamp: Date.now(),
  }));

  // Simple auto-reply
  const lower = body.toLowerCase().trim();
  if (lower === 'ping') {
    await message.reply('pong');
  } else if (lower === 'hi' || lower === 'hello') {
    await message.reply('Hello! I am your WhatsApp bot. How can I help?');
  }
});

async function start() {
  await publishStatus('starting');
  client.initialize();
}

start().catch(async (err) => {
  console.error('Failed to start bot engine:', err);
  await publishStatus('error', { message: err.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down bot engine...');
  await publishStatus('stopped');
  await client.destroy();
  await redis.quit();
  await redisPub.quit();
  process.exit(0);
});
