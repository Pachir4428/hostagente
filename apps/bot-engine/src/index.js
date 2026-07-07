/**
 * HostAgente generic bot runner — one container per manual bot.
 *
 * Runs an uploaded Node.js project (e.g. a full Baileys bot) exactly like a
 * terminal would: extracts the uploaded ZIP, runs `npm install`, then starts
 * the project's own entry point, streaming all stdout/stderr to the web
 * console via Redis. Also accepts arbitrary shell commands (published to
 * `bot:{id}:cmd`) so the operator can run setup scripts / heredocs, and stdin
 * input (`bot:{id}:stdin`) forwarded to the running process.
 *
 * Env: BOT_ID, REDIS_URL.
 * Project dir: /data/projects/{BOT_ID}
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Redis = require('ioredis');

const BOT_ID = process.env.BOT_ID;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
if (!BOT_ID) {
  console.error('BOT_ID is required');
  process.exit(1);
}

const DIR = `/data/projects/${BOT_ID}`;
const redis = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);

const K = {
  status: `bot:${BOT_ID}:status`,
  logs: `bot:${BOT_ID}:logs`,
  cmd: `bot:${BOT_ID}:cmd`,
  stdin: `bot:${BOT_ID}:stdin`,
  config: `bot:${BOT_ID}:config`,
  stats: `bot:${BOT_ID}:stats`,
};

let child = null; // the running project process
let workdir = DIR; // resolved project root (may be a subfolder of DIR)
let stopping = false; // true during graceful shutdown / operator stop
let startedAt = null; // when the current child started (for uptime)
let restarts = 0; // auto-restart counter since boot
let lastActivity = Date.now(); // last log line time
let currentStart = null; // resolved start command (for auto-restart)
const MAX_RESTARTS = 5;

// Strip ANSI escape codes so npm/Baileys output is readable in the web console.
function clean(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
}

function log(line) {
  const text = clean(line);
  if (text.trim() === '') return;
  lastActivity = Date.now();
  process.stdout.write(text + '\n');
  redis.rpush(K.logs, text).catch(() => {});
  redis.ltrim(K.logs, -800, -1).catch(() => {});
  redis.expire(K.logs, 60 * 60 * 24).catch(() => {});
}

function setStatus(s) {
  redis.set(K.status, s, 'EX', 60 * 60 * 24).catch(() => {});
}

// Publish live stats for the web console (uptime, restarts, activity).
function publishStats() {
  const stats = {
    running: !!child,
    startedAt,
    uptimeMs: startedAt ? Date.now() - startedAt : 0,
    restarts,
    lastActivity,
  };
  redis.set(K.stats, JSON.stringify(stats), 'EX', 60 * 60 * 24).catch(() => {});
}

function streamLines(stream) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const l of lines) if (l.trim() !== '') log(l);
  });
  stream.on('end', () => {
    if (buf.trim() !== '') log(buf);
  });
}

// Run a shell command inside the project dir, streaming output. Returns the
// child so callers can await exit.
function run(cmd, { label, cwd } = {}) {
  if (label) log(`$ ${label}`);
  const c = spawn('sh', ['-c', cmd], { cwd: cwd || workdir, env: { ...process.env } });
  streamLines(c.stdout);
  streamLines(c.stderr);
  return c;
}

// Read the operator's saved bot config (start command / subfolder) from Redis.
async function readConfig() {
  try {
    const raw = await redis.get(K.config);
    if (!raw) return {};
    const cfg = JSON.parse(raw);
    return cfg && typeof cfg === 'object' ? cfg : {};
  } catch {
    return {};
  }
}

// Find the real project root: the folder that actually contains package.json /
// index.js / bot.js. Handles ZIPs that wrap everything in a subfolder (e.g.
// "base-bot/"). Searches the base and up to 2 levels of subfolders.
function findProjectRoot(base) {
  const isRoot = (d) =>
    fs.existsSync(path.join(d, 'package.json')) ||
    fs.existsSync(path.join(d, 'index.js')) ||
    fs.existsSync(path.join(d, 'bot.js'));
  if (isRoot(base)) return base;
  const skip = new Set(['node_modules', '.git', 'auth', 'assets', 'storage']);
  let dirs = [base];
  for (let depth = 0; depth < 2; depth++) {
    const next = [];
    for (const d of dirs) {
      let entries = [];
      try {
        entries = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.isDirectory() || skip.has(e.name)) continue;
        const sub = path.join(d, e.name);
        if (isRoot(sub)) return sub;
        next.push(sub);
      }
    }
    dirs = next;
  }
  return base;
}

// Decide the start command for a given project root. Honors an explicit
// operator-provided command first (they may have renamed the entry file).
function detectStart(dir, explicit) {
  if (explicit && explicit.trim()) {
    const cmd = explicit.trim();
    // Accept either a bare filename (index.js) or a full command (npm start).
    if (/^[\w./-]+\.(js|mjs|cjs|ts)$/.test(cmd)) return `node ${cmd}`;
    return cmd;
  }
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts && pkg.scripts.start) return 'npm start';
      if (pkg.main && fs.existsSync(path.join(dir, pkg.main))) return `node ${pkg.main}`;
    } catch {
      /* fall through */
    }
    if (fs.existsSync(path.join(dir, 'index.js'))) return 'node index.js';
    if (fs.existsSync(path.join(dir, 'bot.js'))) return 'node bot.js';
    return 'npm start';
  }
  if (fs.existsSync(path.join(dir, 'index.js'))) return 'node index.js';
  if (fs.existsSync(path.join(dir, 'bot.js'))) return 'node bot.js';
  return null;
}

async function extractIfNeeded() {
  const zip = path.join(DIR, 'project.zip');
  if (fs.existsSync(zip)) {
    log('📦 A descompactar projeto…');
    await new Promise((resolve) => {
      const c = run(`unzip -o project.zip && rm -f project.zip`, {});
      c.on('exit', resolve);
    });
  }
}

function installDeps() {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.join(workdir, 'package.json'))) return resolve();
    log('📥 npm install… (pode demorar)');
    const c = run('npm install --no-audit --no-fund', {});
    c.on('exit', (code) => {
      log(code === 0 ? '✅ Dependências instaladas.' : `⚠️ npm install saiu com código ${code}`);
      resolve();
    });
  });
}

async function startProject(explicitCmd) {
  const startCmd = detectStart(workdir, explicitCmd);
  if (!startCmd) {
    log('⚠️ Não encontrei o ficheiro de arranque. Indica-o em "Arranque" (ex: index.js ou npm start) ou carrega um ZIP com package.json.');
    setStatus('error');
    return;
  }
  currentStart = startCmd;
  restarts = 0;
  spawnChild();
}

function spawnChild() {
  log(`▶️ A iniciar: ${currentStart}  (pasta: ${path.relative(DIR, workdir) || '.'})`);
  setStatus('connected'); // "a correr"
  startedAt = Date.now();
  publishStats();
  child = spawn('sh', ['-c', currentStart], { cwd: workdir, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  streamLines(child.stdout);
  streamLines(child.stderr);
  child.on('exit', (code) => {
    child = null;
    startedAt = null;
    if (stopping) {
      setStatus('stopped');
      publishStats();
      return;
    }
    if (code === 0) {
      log('⏹️ Processo terminou normalmente (código 0).');
      setStatus('stopped');
      publishStats();
      return;
    }
    // Crashed — auto-restart with backoff, up to MAX_RESTARTS.
    if (restarts < MAX_RESTARTS) {
      restarts++;
      const delay = Math.min(30000, 3000 * restarts);
      log(`⚠️ O bot caiu (código ${code}). Reinício automático ${restarts}/${MAX_RESTARTS} em ${Math.round(delay / 1000)}s…`);
      setStatus('starting');
      publishStats();
      setTimeout(() => {
        if (!stopping) spawnChild();
      }, delay);
    } else {
      log(`🛑 O bot caiu ${restarts} vezes seguidas. Parei os reinícios automáticos — verifica os logs e clica em Iniciar.`);
      setStatus('error');
      publishStats();
    }
  });
}

async function boot() {
  fs.mkdirSync(DIR, { recursive: true });
  setStatus('starting');
  log('🔧 Bot engine a iniciar…');
  await extractIfNeeded();

  const cfg = await readConfig();
  // Resolve the project root: explicit subfolder from config, else auto-detect.
  if (cfg.workdir && cfg.workdir.trim()) {
    workdir = path.resolve(DIR, cfg.workdir.trim());
    if (!workdir.startsWith(DIR)) workdir = DIR; // guard against traversal
  } else {
    workdir = findProjectRoot(DIR);
  }
  if (workdir !== DIR) log(`📁 Projeto encontrado em: ${path.relative(DIR, workdir)}`);

  await installDeps();
  await startProject(cfg.startCommand);
}

// Operator commands + stdin, via Redis pub/sub.
redisSub.subscribe(K.cmd, K.stdin).catch(() => {});
redisSub.on('message', (channel, message) => {
  if (channel === K.cmd) {
    // Forgiving: a bare script path (index.js, base-bot/bot.js) is run with node
    // so the operator doesn't hit "Permission denied" (exit 126).
    let cmd = String(message).trim();
    if (/^[\w./-]+\.(js|mjs|cjs)$/.test(cmd)) cmd = `node ${cmd}`;
    log(`\n$ ${cmd}`);
    const c = run(cmd, {});
    c.on('exit', (code) => log(`(exit ${code})`));
  } else if (channel === K.stdin && child && child.stdin.writable) {
    child.stdin.write(message + '\n');
  }
});

boot().catch((err) => {
  log(`Erro fatal: ${err.message}`);
  setStatus('error');
});

// Keep live stats fresh for the web console.
setInterval(publishStats, 5000);

function shutdown() {
  stopping = true;
  log('🛑 A encerrar…');
  setStatus('stopped');
  if (child) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
