'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { authApi } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { botStatus } from '@/lib/botStatus';
import { Logo } from '@/components/Logo';

interface Bot {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
  containerId?: string;
  createdAt: string;
  updatedAt: string;
}

const TABS = ['Conectar', 'Comandos', 'Menus', 'Registos', 'Definições'] as const;
type Tab = (typeof TABS)[number];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function BotDetailPage() {
  const router = useRouter();
  const params = useParams();
  const botId = params.id as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('Conectar');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    fetchBot();
    const interval = setInterval(fetchBot, 5000);

    // Live updates via socket.io (QR + status)
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setWsConnected(true);
      socket.emit('subscribe-bot', botId);
    });
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('bot-qr', (payload: { botId: string; qrCode: string }) => {
      if (payload.botId === botId) setQrCode(payload.qrCode);
    });
    socket.on('bot-status', (payload: { botId: string; status: string }) => {
      if (payload.botId === botId) {
        setBot((prev) => (prev ? { ...prev, status: payload.status } : prev));
        if (payload.status === 'running') setQrCode(null);
      }
    });

    return () => {
      clearInterval(interval);
      socket.emit('unsubscribe-bot', botId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  async function fetchBot() {
    try {
      const res = await authApi.get(`/bots/${botId}`);
      setBot(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        clearToken();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function startBot() {
    setActionLoading(true);
    try {
      await authApi.post(`/bots/${botId}/start`);
      await fetchBot();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Não foi possível iniciar o bot');
    } finally {
      setActionLoading(false);
    }
  }

  async function stopBot() {
    setActionLoading(true);
    try {
      await authApi.post(`/bots/${botId}/stop`);
      setQrCode(null);
      await fetchBot();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Não foi possível parar o bot');
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteBot() {
    if (!confirm('Eliminar este bot? Esta ação não pode ser revertida.')) return;
    setActionLoading(true);
    try {
      await authApi.delete(`/bots/${botId}`);
      router.replace('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Não foi possível eliminar o bot');
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted">Bot não encontrado</p>
        <Link href="/dashboard" className="btn-ghost">← Voltar aos bots</Link>
      </div>
    );
  }

  const s = botStatus(bot.status);
  const isRunning = bot.status === 'running' || bot.status === 'waiting_qr';
  const isBusy = bot.status === 'starting' || bot.status === 'stopping' || actionLoading;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Link href="/dashboard" className="flex items-center gap-3 text-muted transition hover:text-ink">
            <span>←</span> <span className="hidden sm:inline">Voltar aos bots</span>
          </Link>
          <Logo size="sm" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 font-display text-xl font-bold text-teal">
              {bot.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{bot.name}</h1>
              {bot.phoneNumber && <p className="text-sm text-muted">{bot.phoneNumber}</p>}
            </div>
            <span className={`chip ${s.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          </div>
          <div className="flex gap-3">
            {!isRunning ? (
              <button onClick={startBot} disabled={isBusy} className="btn-primary">
                {isBusy ? 'Aguarda…' : '▶ Iniciar'}
              </button>
            ) : (
              <button onClick={stopBot} disabled={isBusy} className="btn-ghost">
                {isBusy ? 'Aguarda…' : '■ Parar'}
              </button>
            )}
            <button onClick={deleteBot} disabled={isBusy} className="btn-danger">Eliminar</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-8">
          {tab === 'Conectar' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* QR / pairing */}
              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold">Ligar aparelho</h2>
                <p className="mt-1 text-sm text-muted">
                  Abre o WhatsApp → Aparelhos ligados → Ligar aparelho e aponta a câmara ao código.
                </p>

                <div className="mt-6 flex flex-col items-center">
                  {qrCode ? (
                    <div className="rounded-2xl bg-white p-4">
                      <img
                        alt="QR Code"
                        width={224}
                        height={224}
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=${encodeURIComponent(qrCode)}`}
                      />
                    </div>
                  ) : isRunning && bot.status === 'waiting_qr' ? (
                    <div className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line text-center text-muted">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-teal" />
                      <p className="text-sm">A gerar QR code…</p>
                    </div>
                  ) : bot.status === 'running' ? (
                    <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 rounded-2xl border border-teal/30 bg-teal/5 text-center">
                      <span className="text-3xl">✓</span>
                      <p className="font-display font-semibold text-teal">Ligado</p>
                      <p className="text-xs text-muted">O bot está a responder.</p>
                    </div>
                  ) : (
                    <div className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line text-center text-muted">
                      <span className="text-3xl">📱</span>
                      <p className="px-6 text-sm">Inicia o bot para gerar o QR code de ligação.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Connection state */}
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="font-display font-semibold">Estado da ligação</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted">WebSocket</dt>
                      <dd className={wsConnected ? 'text-teal' : 'text-muted2'}>
                        ● {wsConnected ? 'Ligado' : 'Desligado'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted">Estado</dt>
                      <dd className="text-ink">{s.label}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted">Container</dt>
                      <dd className="font-mono text-xs text-ink">
                        {bot.containerId ? bot.containerId.slice(0, 12) : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted">Criado</dt>
                      <dd className="text-ink">{new Date(bot.createdAt).toLocaleDateString('pt-PT')}</dd>
                    </div>
                  </dl>
                </div>
                <div className="card p-5">
                  <h3 className="font-display font-semibold">ID do bot</h3>
                  <p className="mt-2 break-all font-mono text-xs text-muted">{bot.id}</p>
                </div>
              </div>
            </div>
          )}

          {tab !== 'Conectar' && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-xl">🛠️</div>
              <p className="mt-4 font-display text-lg font-semibold">{tab}</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Esta secção estará disponível em breve. Por agora podes ligar e monitorizar o teu
                bot no separador <span className="text-teal">Conectar</span>.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
