'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { botStatus } from '@/lib/botStatus';
import { Logo } from '@/components/Logo';

interface Bot {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    fetchBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBots() {
    try {
      const res = await authApi.get('/bots');
      setBots(res.data);
    } catch {
      clearToken();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  async function createBot() {
    if (!newBotName.trim()) return;
    setCreating(true);
    try {
      await authApi.post('/bots', { name: newBotName.trim() });
      setNewBotName('');
      setShowModal(false);
      fetchBots();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Não foi possível criar o bot');
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  const filtered = bots.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="chip hidden border border-line bg-white/[0.03] text-muted sm:inline-flex">
              ◈ Plano FREE
            </span>
            <button
              onClick={handleLogout}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:bg-white/[0.05] hover:text-ink"
              title="Sair"
            >
              ⏻
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Os teus bots</h1>
            <p className="mt-1 text-sm text-muted">Gere, liga e monitoriza os teus bots de WhatsApp.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted2">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar…"
                className="field !w-48 pl-8"
              />
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary whitespace-nowrap">
              + Novo bot
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card mt-8 flex flex-col items-center justify-center py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/10 text-2xl">🤖</div>
            <p className="mt-4 font-display text-lg font-semibold">
              {bots.length === 0 ? 'Ainda não tens bots' : 'Nenhum bot encontrado'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {bots.length === 0 ? 'Cria o teu primeiro bot para começar.' : 'Tenta outra pesquisa.'}
            </p>
            {bots.length === 0 && (
              <button onClick={() => setShowModal(true)} className="btn-primary mt-6">
                + Criar primeiro bot
              </button>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((bot) => {
              const s = botStatus(bot.status);
              return (
                <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
                  <div className="card group h-full p-5 transition hover:border-teal/30 hover:shadow-glow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 font-display font-bold text-teal">
                          {bot.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-display font-semibold">{bot.name}</h3>
                          {bot.phoneNumber && <p className="text-xs text-muted">{bot.phoneNumber}</p>}
                        </div>
                      </div>
                      <span className={`chip ${s.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-xs text-muted">
                      <span>Criado {new Date(bot.createdAt).toLocaleDateString('pt-PT')}</span>
                      <span className="text-teal opacity-0 transition group-hover:opacity-100">Abrir →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Criar novo bot</h2>
            <p className="mt-1 text-sm text-muted">
              Define o essencial. Podes afinar comandos e menus depois de criar.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">Nome do bot</label>
                <input
                  autoFocus
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createBot()}
                  placeholder="Ex: Atende Já"
                  className="field"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={createBot} disabled={creating || !newBotName.trim()} className="btn-primary">
                {creating ? 'A criar…' : 'Criar bot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
