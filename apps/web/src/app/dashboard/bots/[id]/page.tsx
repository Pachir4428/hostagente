'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';

interface Bot {
  id: string;
  name: string;
  type: 'auto' | 'manual';
  status: string;
  phoneNumber?: string | null;
  hasScript: boolean;
}
interface Live {
  status: string;
  logs: string[];
}

const STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  connected: { label: 'A correr', chip: 'bg-teal/10 text-teal border border-teal/25', dot: 'bg-teal' },
  starting: { label: 'A iniciar', chip: 'bg-gold/10 text-gold border border-gold/25', dot: 'bg-gold' },
  stopped: { label: 'Parado', chip: 'bg-hover text-muted border border-line', dot: 'bg-muted2' },
  error: { label: 'Erro', chip: 'bg-danger/10 text-danger border border-danger/25', dot: 'bg-danger' },
};
const st = (s: string) => STATUS[s] || STATUS.stopped;

export default function BotConsolePage() {
  const { user, loading } = useAuth('TENANT');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [live, setLive] = useState<Live>({ status: 'stopped', logs: [] });
  const [busy, setBusy] = useState('');
  const [cmd, setCmd] = useState('');
  const [uploadName, setUploadName] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);

  async function loadBot() {
    const res = await authApi.get(`/bots/${id}`);
    setBot(res.data);
  }
  async function loadLive() {
    try {
      const res = await authApi.get(`/bots/${id}/live`);
      setLive(res.data);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!user) return;
    loadBot();
    loadLive();
    const iv = setInterval(loadLive, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [live.logs]);

  async function control(action: 'start' | 'stop' | 'restart') {
    setBusy(action);
    try {
      const res = await authApi.post(`/bots/${id}/${action}`);
      if (res.data?.success === false) alert(res.data.message || 'Falhou');
      await loadBot();
      await loadLive();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao controlar o bot');
    } finally {
      setBusy('');
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadName(file.name);
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authApi.post(`/bots/${id}/upload`, fd);
      alert(res.data?.message || 'Projeto carregado.');
      await loadBot();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha no upload');
    } finally {
      setBusy('');
    }
  }

  async function sendCommand() {
    const c = cmd.trim();
    if (!c) return;
    setCmd('');
    setLive((prev) => ({ ...prev, logs: [...prev.logs, `$ ${c}`] }));
    try {
      const res = await authApi.post(`/bots/${id}/command`, { command: c });
      if (res.data?.success === false) alert(res.data.message || 'O bot precisa de estar a correr.');
    } catch {
      /* ignore */
    }
  }

  async function remove() {
    if (!confirm('Eliminar este bot?')) return;
    await authApi.delete(`/bots/${id}`);
    router.replace('/dashboard/bots');
  }

  if (loading || !bot) {
    return (
      <AppShell nav={TENANT_NAV} title="Bot" email={user?.email}>
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      </AppShell>
    );
  }

  const s = st(live.status || bot.status);
  const running = ['connected', 'starting'].includes(live.status);

  return (
    <AppShell nav={TENANT_NAV} title={bot.name} email={user?.email}>
      <Link href="/dashboard/bots" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <i className="fa-solid fa-arrow-left" /> Voltar aos bots
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`chip ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
          <span className="text-sm text-muted">{bot.type === 'manual' ? 'Manual (projeto Node/Baileys)' : 'Automático (MacroDroid)'}</span>
        </div>
        {bot.type === 'manual' && (
          <div className="flex gap-2">
            {!running ? (
              <button onClick={() => control('start')} disabled={!!busy} className="btn-primary"><i className="fa-solid fa-play" /> Iniciar</button>
            ) : (
              <button onClick={() => control('stop')} disabled={!!busy} className="btn-ghost"><i className="fa-solid fa-stop" /> Parar</button>
            )}
            <button onClick={() => control('restart')} disabled={!!busy} className="btn-ghost" title="Reiniciar"><i className="fa-solid fa-rotate" /></button>
            <button onClick={remove} disabled={!!busy} className="btn-danger" title="Eliminar"><i className="fa-solid fa-trash" /></button>
          </div>
        )}
      </div>

      {bot.type === 'auto' ? (
        <div className="card p-6">
          <p className="font-display font-semibold">Bot automático (MacroDroid)</p>
          <p className="mt-2 text-sm text-muted">
            Configura a chave de API e o endpoint em{' '}
            <Link href="/dashboard/account" className="text-teal hover:underline">Conta &amp; API</Link>.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Project / upload */}
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold">Projeto do bot</h2>
              <p className="mt-1 text-xs text-muted">
                Carrega o teu projeto Node/Baileys (ZIP com <code className="text-teal">package.json</code>).
                Ao iniciar, a plataforma descompacta, corre <code className="text-teal">npm install</code> e
                arranca o bot. O QR / código aparece na consola à direita.
              </p>
              <label className="btn-primary mt-4 w-full cursor-pointer">
                <i className="fa-solid fa-file-zipper" /> {busy === 'upload' ? 'A carregar…' : 'Carregar ZIP'}
                <input type="file" accept=".zip" onChange={onUpload} className="hidden" />
              </label>
              {uploadName && <p className="mt-2 truncate text-xs text-muted">{uploadName}</p>}
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className={bot.hasScript ? 'text-teal' : 'text-muted'}>
                  <i className={`fa-solid ${bot.hasScript ? 'fa-circle-check' : 'fa-circle'} mr-1`} />
                  {bot.hasScript ? 'Projeto carregado' : 'Sem projeto ainda'}
                </span>
              </div>
            </div>

            <div className="card p-5 text-xs text-muted">
              <p className="font-display text-sm font-semibold text-ink">Dicas</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>O ZIP deve ter o <code className="text-teal">package.json</code> na raiz.</li>
                <li>Ligação por QR ou código é feita pelo teu próprio projeto — vê a consola.</li>
                <li>Podes correr comandos (ex: scripts de setup) no terminal abaixo.</li>
              </ul>
            </div>
          </div>

          {/* Terminal console */}
          <div className="card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-display text-sm font-semibold"><i className="fa-solid fa-terminal mr-2 text-teal" />Consola</h2>
              <button onClick={loadLive} className="text-xs text-muted hover:text-ink"><i className="fa-solid fa-rotate mr-1" />atualizar</button>
            </div>
            <div ref={logsRef} className="h-[420px] overflow-y-auto bg-black/50 p-4 font-mono text-xs leading-relaxed">
              {live.logs.length === 0 ? (
                <p className="text-muted2">Sem logs. Carrega um projeto e clica em Iniciar…</p>
              ) : (
                live.logs.map((l, i) => <div key={i} className="whitespace-pre-wrap text-muted">{l}</div>)
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-black/30 px-3 py-2">
              <span className="font-mono text-sm text-teal">$</span>
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                placeholder="comando (ex: ls, npm install, node setup.js)…"
                spellCheck={false}
                className="flex-1 bg-transparent font-mono text-xs text-ink placeholder:text-muted2 focus:outline-none"
              />
              <button onClick={sendCommand} className="btn-ghost !px-3 !py-1 text-xs">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
