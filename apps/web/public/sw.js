// Service worker mínimo do HostAgente.
// Ativa a instalabilidade (PWA) sem interferir com as chamadas à API:
// nunca faz cache de pedidos à API — só serve para "Adicionar ao ecrã inicial"
// e para respostas offline básicas de navegação.
const CACHE = 'hostagente-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Só trata navegações GET do próprio domínio; deixa a API e o resto passar.
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(fetch(req).catch(() => caches.match('/')));
});
