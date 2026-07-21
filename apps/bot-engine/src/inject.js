/**
 * Auto-injeção HostAgente (zero configuração).
 *
 * Pré-carregado no processo do bot via NODE_OPTIONS=--require. Interceta a
 * criação do socket Baileys (makeWASocket) de QUALQUER projeto, sem o utilizador
 * mexer no código, e reporta ao painel:
 *   - o QR code (para o painel o mostrar como imagem),
 *   - os grupos do WhatsApp (nome, descrição, admins, nº de membros),
 *   - responde aos pedidos de "varrer" e "broadcast" do painel.
 *
 * Usa BOT_ID e REDIS_URL (injetados pelo container). Falha em silêncio se algo
 * não estiver disponível — nunca quebra o bot do utilizador.
 */
try {
  const Module = require('module');
  const Redis = require('ioredis'); // resolvido a partir de /app/node_modules
  const BOT_ID = process.env.BOT_ID || process.env.PAINEL_BOT_ID || '';
  const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

  if (BOT_ID) {
    const rq = new Redis(REDIS_URL);
    rq.on('error', () => {});

    const logLine = (line) => {
      rq.rpush('bot:' + BOT_ID + ':logs', line).catch(() => {});
      rq.ltrim('bot:' + BOT_ID + ':logs', -800, -1).catch(() => {});
      rq.publish('bot:' + BOT_ID + ':stream', JSON.stringify({ type: 'log', line })).catch(() => {});
    };

    async function reportGroups(sock) {
      try {
        const meta = await sock.groupFetchAllParticipating();
        const groups = Object.values(meta).map((g) => ({
          id: g.id,
          name: g.subject || 'Grupo',
          description: g.desc || '',
          admins: (g.participants || [])
            .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
            .map((p) => '+' + String(p.id).split('@')[0]),
          participants: (g.participants || []).length,
        }));
        await rq.set('bot:' + BOT_ID + ':groups', JSON.stringify(groups), 'EX', 60 * 60 * 24 * 7).catch(() => {});
        logLine('📡 Grupos sincronizados do WhatsApp: ' + groups.length);
      } catch (e) {
        /* ainda a ligar */
      }
    }

    // Número para ligação por código de emparelhamento (opcional).
    const PAIR_PHONE = (process.env.PHONE || process.env.PAIR_PHONE || '').replace(/\D/g, '');

    function attach(sock) {
      let pairAsked = false;
      // QR + ligação
      sock.ev.on('connection.update', async (u) => {
        if (u.qr) {
          if (PAIR_PHONE && typeof sock.requestPairingCode === 'function') {
            // Ligação por código: pede o código uma vez e publica-o (sem QR).
            if (!pairAsked) {
              pairAsked = true;
              try {
                const code = await sock.requestPairingCode(PAIR_PHONE);
                const pretty = String(code).match(/.{1,4}/g)?.join('-') || code;
                await rq.set('bot:' + BOT_ID + ':pairing', pretty, 'EX', 120).catch(() => {});
                logLine('🔑 Código de emparelhamento: ' + pretty);
              } catch (e) {
                // Se falhar o código, cai para o QR normal.
                pairAsked = false;
                rq.set('bot:' + BOT_ID + ':qr', u.qr, 'EX', 90).catch(() => {});
              }
            }
          } else {
            rq.set('bot:' + BOT_ID + ':qr', u.qr, 'EX', 90).catch(() => {});
          }
        }
        if (u.connection === 'open') {
          rq.del('bot:' + BOT_ID + ':qr', 'bot:' + BOT_ID + ':pairing').catch(() => {});
          logLine('✅ WhatsApp ligado — a sincronizar grupos…');
          setTimeout(() => reportGroups(sock), 4000);
        }
      });
      // Reporte periódico
      setInterval(() => reportGroups(sock), 5 * 60 * 1000);

      // Pedidos do painel: varrer + broadcast
      const sub = new Redis(REDIS_URL);
      sub.on('error', () => {});
      sub.subscribe('bot:' + BOT_ID + ':sync', 'bot:' + BOT_ID + ':broadcast').catch(() => {});
      sub.on('message', async (ch, payload) => {
        if (ch.endsWith(':sync')) return reportGroups(sock);
        if (ch.endsWith(':broadcast')) {
          try {
            const d = JSON.parse(payload);
            logLine('📣 A enviar broadcast para ' + d.numbers.length + ' cliente(s)…');
            for (const n of d.numbers) {
              try {
                await sock.sendMessage(String(n).replace(/\D/g, '') + '@s.whatsapp.net', { text: d.message });
              } catch (e) {
                /* ignora número inválido */
              }
              await new Promise((r) => setTimeout(r, 3000));
            }
            logLine('📣 Broadcast concluído.');
          } catch (e) {
            /* payload inválido */
          }
        }
      });
    }

    // Interceta o require do Baileys e embrulha o makeWASocket.
    const origLoad = Module._load;
    let hooked = false;
    let latestVersion = null; // versão atual do WhatsApp Web (best-effort)
    Module._load = function (request, parent, isMain) {
      const m = origLoad.apply(this, arguments);
      try {
        if (!hooked && typeof request === 'string' && request.includes('baileys') && m) {
          const key = typeof m.default === 'function' ? 'default' : typeof m.makeWASocket === 'function' ? 'makeWASocket' : null;
          if (key) {
            hooked = true;
            // Descobre a versão atual do WhatsApp Web assim que o Baileys carrega.
            // Sem versão atual, o servidor recusa a ligação (405) — causa nº1 de
            // "liga localmente mas não no servidor". Injetamos se o bot não a definir.
            try {
              if (typeof m.fetchLatestBaileysVersion === 'function') {
                m.fetchLatestBaileysVersion()
                  .then((r) => {
                    latestVersion = r && r.version;
                    if (latestVersion) logLine('📶 WhatsApp Web v' + latestVersion.join('.'));
                  })
                  .catch(() => {});
              }
            } catch (e) {
              /* ignore */
            }
            const appropriate =
              m.Browsers && typeof m.Browsers.appropriate === 'function'
                ? m.Browsers.appropriate('Chrome')
                : ['HostAgente', 'Chrome', '120.0.0'];
            const original = m[key];
            m[key] = function () {
              try {
                const cfg = arguments[0];
                if (cfg && typeof cfg === 'object') {
                  if (!cfg.version && latestVersion) cfg.version = latestVersion;
                  if (!cfg.browser) cfg.browser = appropriate;
                }
              } catch (e) {
                /* ignore */
              }
              const sock = original.apply(this, arguments);
              try {
                attach(sock);
              } catch (e) {
                /* nunca quebra o bot */
              }
              return sock;
            };
          }
        }
      } catch (e) {
        /* ignore */
      }
      return m;
    };
  }
} catch (e) {
  /* injeção opcional — nunca quebra o bot */
}
