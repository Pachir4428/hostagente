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
  config?: any;
}
interface Live {
  status: string;
  qr: string | null;
  pairing: string | null;
  logs: string[];
}

const STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  connected: { label: 'Ligado', chip: 'bg-teal/10 text-teal border border-teal/25', dot: 'bg-teal' },
  waiting_qr: { label: 'A aguardar QR', chip: 'bg-gold/10 text-gold border border-gold/25', dot: 'bg-gold' },
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
  const [live, setLive] = useState<Live>({ status: 'stopped', qr: null, pairing: null, logs: [] });
  const [busy, setBusy] = useState('');
  const [welcome, setWelcome] = useState('');
  const [script, setScript] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);

  async function loadBot() {
    const res = await authApi.get(`/bots/${id}`);
    setBot(res.data);
    setWelcome(res.data.config?.welcomeMessage || '');
    if (res.data.hasScript) {
      authApi.get(`/bots/${id}/script`).then((r) => setScript(r.data.content)).catch(() => {});
    }
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
    const iv = setInterval(loadLive, 2500);
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

  async function saveConfig() {
    setBusy('config');
    try {
      await authApi.patch(`/bots/${id}`, { config: { ...(bot?.config || {}), welcomeMessage: welcome } });
      await loadBot();
    } finally {
      setBusy('');
    }
  }

  async function saveScript() {
    setBusy('script');
    try {
      await authApi.post(`/bots/${id}/script`, { content: script });
      await loadBot();
      alert('Script guardado. Reinicia o bot para aplicar.');
    } finally {
      setBusy('');
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScript(String(reader.result || ''));
    reader.readAsText(file);
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
  const running = ['connected', 'waiting_qr', 'starting'].includes(live.status);

  return (
    <AppShell nav={TENANT_NAV} title={bot.name} email={user?.email}>
      <Link href="/dashboard/bots" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <i className="fa-solid fa-arrow-left" /> Voltar aos bots
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`chip ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
          <span className="text-sm text-muted">{bot.type === 'manual' ? 'Manual (Baileys)' : 'Automático (MacroDroid)'}</span>
        </div>
        {bot.type === 'manual' && (
          <div className="flex gap-2">
            {!running ? (
              <button onClick={() => control('start')} disabled={!!busy} className="btn-primary"><i className="fa-solid fa-play" /> Iniciar</button>
            ) : (
              <button onClick={() => control('stop')} disabled={!!busy} className="btn-ghost"><i className="fa-solid fa-stop" /> Parar</button>
            )}
            <button onClick={() => control('restart')} disabled={!!busy} className="btn-ghost"><i className="fa-solid fa-rotate" /></button>
            <button onClick={remove} disabled={!!busy} className="btn-danger"><i className="fa-solid fa-trash" /></button>
          </div>
        )}
      </div>

      {bot.type === 'auto' ? (
        <div className="card p-6">
          <p className="font-display font-semibold">Bot automático (MacroDroid)</p>
          <p className="mt-2 text-sm text-muted">
            Este bot deteta pagamentos via MacroDroid. Configura a chave de API e o endpoint em{' '}
            <Link href="/dashboard/account" className="text-teal hover:underline">Conta &amp; API</Link>.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Connect + config */}
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold">Ligar ao WhatsApp</h2>
              <div className="mt-5 flex flex-col items-center">
                {live.qr ? (
                  <>
                    <div className="rounded-2xl bg-white p-3">
                      <img alt="QR" width={220} height={220} src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(live.qr)}`} />
                    </div>
                    <p className="mt-3 text-center text-xs text-muted">WhatsApp → Aparelhos ligados → Ligar aparelho</p>
                  </>
                ) : live.pairing ? (
                  <div className="text-center">
                    <p className="text-sm text-muted">Código de emparelhamento</p>
                    <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-teal">{live.pairing}</p>
                    <p className="mt-2 text-xs text-muted">WhatsApp → Aparelhos ligados → Ligar com número</p>
                  </div>
                ) : live.status === 'connected' ? (
                  <div className="flex h-52 flex-col items-center justify-center gap-2 text-center">
                    <i className="fa-solid fa-circle-check text-4xl text-teal" />
                    <p className="font-display font-semibold text-teal">Ligado</p>
                  </div>
                ) : (
                  <div className="flex h-52 flex-col items-center justify-center gap-3 text-center text-muted">
                    <i className="fa-brands fa-whatsapp text-4xl" />
                    <p className="px-6 text-sm">Inicia o bot para gerar o QR ou código.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold">Mensagem automática</h2>
              <p className="mt-1 text-xs text-muted">Resposta enviada quando não há script personalizado.</p>
              <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} className="field mt-3 min-h-[90px]" placeholder="Olá! Obrigado pela tua mensagem." />
              <button onClick={saveConfig} disabled={busy === 'config'} className="btn-ghost mt-3 text-sm">{busy === 'config' ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </div>

          {/* Console: logs + script */}
          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-display text-sm font-semibold"><i className="fa-solid fa-terminal mr-2 text-teal" />Consola</h2>
                <span className="text-xs text-muted">logs ao vivo</span>
              </div>
              <div ref={logsRef} className="h-72 overflow-y-auto bg-black/40 p-4 font-mono text-xs leading-relaxed">
                {live.logs.length === 0 ? (
                  <p className="text-muted2">Sem logs. Inicia o bot para ver a atividade…</p>
                ) : (
                  live.logs.map((l, i) => <div key={i} className="whitespace-pre-wrap text-muted">{l}</div>)
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">Script do bot (Node.js / Baileys)</h2>
                <label className="btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
                  <i className="fa-solid fa-upload" /> Carregar .js
                  <input type="file" accept=".js" onChange={onFile} className="hidden" />
                </label>
              </div>
              <p className="mt-1 text-xs text-muted">
                Exporta uma função <code className="text-teal">module.exports = async (sock, msg, ctx) =&gt; {'{}'}</code> para tratares as mensagens.
              </p>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                spellCheck={false}
                className="field mt-3 min-h-[180px] font-mono text-xs"
                placeholder={`module.exports = async (sock, msg, ctx) => {\n  const jid = msg.key.remoteJid;\n  await sock.sendMessage(jid, { text: 'Olá!' });\n};`}
              />
              <button onClick={saveScript} disabled={busy === 'script'} className="btn-primary mt-3 text-sm">{busy === 'script' ? 'A guardar…' : 'Guardar script'}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
