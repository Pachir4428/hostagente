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
  hasScript: boolean;
}
interface FileNode {
  path: string;
  type: 'file' | 'dir';
  size: number;
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
  const [status, setStatus] = useState('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [cmd, setCmd] = useState('');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const cmdHistory = useRef<string[]>([]);

  async function loadBot() {
    const res = await authApi.get(`/bots/${id}`);
    setBot(res.data);
  }
  async function loadLive() {
    try {
      const res = await authApi.get(`/bots/${id}/live`);
      setStatus(res.data.status);
      setLogs(res.data.logs || []);
    } catch {
      /* ignore */
    }
  }
  async function loadFiles() {
    try {
      const res = await authApi.get(`/bots/${id}/files`);
      setFiles(res.data);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!user) return;
    loadBot();
    loadLive();
    loadFiles();
    const iv = setInterval(loadLive, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  async function control(action: 'start' | 'stop' | 'restart') {
    setBusy(action);
    try {
      const res = await authApi.post(`/bots/${id}/${action}`);
      if (res.data?.success === false) alert(res.data.message || 'Falhou');
      await loadBot();
      await loadLive();
      setTimeout(loadFiles, 1500);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao controlar o bot');
    } finally {
      setBusy('');
    }
  }

  async function uploadZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authApi.post(`/bots/${id}/upload`, fd);
      alert(res.data?.message || 'Projeto carregado.');
      await loadBot();
      setTimeout(loadFiles, 500);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha no upload');
    } finally {
      setBusy('');
    }
  }

  async function uploadMany(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    e.target.value = '';
    if (!list || list.length === 0) return;
    setBusy('upload');
    try {
      const fd = new FormData();
      for (const f of Array.from(list)) {
        const rel = (f as any).webkitRelativePath || f.name;
        fd.append(rel, f, f.name);
      }
      const res = await authApi.post(`/bots/${id}/files`, fd);
      alert(`${res.data?.count ?? 0} ficheiro(s) carregado(s).`);
      await loadBot();
      loadFiles();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha no upload');
    } finally {
      setBusy('');
    }
  }

  async function openFile(path: string) {
    const res = await authApi.get(`/bots/${id}/file`, { params: { path } });
    if (res.data.tooLarge) return alert('Ficheiro demasiado grande para editar.');
    setEditing({ path, content: res.data.content || '' });
  }
  async function saveFile() {
    if (!editing) return;
    setSavingFile(true);
    try {
      await authApi.post(`/bots/${id}/file`, { path: editing.path, content: editing.content });
      setEditing(null);
      loadFiles();
    } finally {
      setSavingFile(false);
    }
  }
  async function deleteFile(path: string) {
    if (!confirm(`Apagar ${path}?`)) return;
    await authApi.delete(`/bots/${id}/file`, { params: { path } });
    loadFiles();
  }

  async function sendCommand() {
    const c = cmd.trim();
    if (!c) return;
    cmdHistory.current.push(c);
    setCmd('');
    setLogs((prev) => [...prev, `$ ${c}`]);
    try {
      const res = await authApi.post(`/bots/${id}/command`, { command: c });
      if (res.data?.success === false) {
        setLogs((prev) => [...prev, res.data.message || 'O bot precisa de estar a correr.']);
      }
      setTimeout(loadFiles, 1500);
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

  const s = st(status || bot.status);
  const running = ['connected', 'starting'].includes(status);

  return (
    <AppShell nav={TENANT_NAV} title={bot.name} email={user?.email}>
      <Link href="/dashboard/bots" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <i className="fa-solid fa-arrow-left" /> Voltar aos bots
      </Link>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`chip ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
          <span className="text-sm text-muted">{bot.type === 'manual' ? 'Manual (projeto Node/Baileys)' : 'Automático (MacroDroid)'}</span>
        </div>
        {bot.type === 'manual' && (
          <div className="flex flex-wrap gap-2">
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
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* File manager */}
          <div className="card flex max-h-[600px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="font-display text-sm font-semibold"><i className="fa-solid fa-folder-tree mr-2 text-teal" />Ficheiros</span>
              <button onClick={loadFiles} className="text-xs text-muted hover:text-ink" title="Atualizar"><i className="fa-solid fa-rotate" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-line p-2">
              <label className="btn-ghost cursor-pointer !px-2.5 !py-1 text-xs" title="ZIP do projeto">
                <i className="fa-solid fa-file-zipper" /> ZIP
                <input type="file" accept=".zip" onChange={uploadZip} className="hidden" />
              </label>
              <label className="btn-ghost cursor-pointer !px-2.5 !py-1 text-xs" title="Ficheiros">
                <i className="fa-solid fa-file" /> Ficheiros
                <input type="file" multiple onChange={uploadMany} className="hidden" />
              </label>
              <label className="btn-ghost cursor-pointer !px-2.5 !py-1 text-xs" title="Pasta inteira">
                <i className="fa-solid fa-folder" /> Pasta
                {/* @ts-expect-error webkitdirectory is non-standard */}
                <input type="file" multiple webkitdirectory="" directory="" onChange={uploadMany} className="hidden" />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-2 text-sm">
              {busy === 'upload' && <p className="px-2 py-3 text-xs text-teal">A carregar…</p>}
              {files.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted">Sem ficheiros. Carrega um ZIP, ficheiros ou uma pasta.</p>
              ) : (
                files.map((f) => {
                  const depth = f.path.split('/').length - 1;
                  const name = f.path.split('/').pop();
                  return (
                    <div key={f.path} className="group flex items-center gap-1 rounded px-1.5 py-1 hover:bg-hover" style={{ paddingLeft: 6 + depth * 12 }}>
                      <i className={`fa-solid ${f.type === 'dir' ? 'fa-folder text-gold' : 'fa-file text-muted'} w-4 text-xs`} />
                      {f.type === 'file' ? (
                        <button onClick={() => openFile(f.path)} className="flex-1 truncate text-left text-xs text-ink hover:text-teal">{name}</button>
                      ) : (
                        <span className="flex-1 truncate text-xs text-muted">{name}</span>
                      )}
                      <button onClick={() => deleteFile(f.path)} className="text-xs text-muted opacity-0 transition hover:text-danger group-hover:opacity-100" title="Apagar"><i className="fa-solid fa-xmark" /></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Terminal */}
          <div className="card flex max-h-[600px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-display text-sm font-semibold"><i className="fa-solid fa-terminal mr-2 text-teal" />Terminal</span>
              <button onClick={() => setLogs([])} className="text-xs text-muted hover:text-ink">limpar</button>
            </div>
            <div ref={logsRef} className="flex-1 overflow-y-auto bg-[#0b0f14] p-4 font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
              {logs.length === 0 ? (
                <p className="text-[#6e7681]">Sem output. Carrega um projeto e clica em Iniciar, ou escreve um comando abaixo…</p>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={`whitespace-pre-wrap ${l.startsWith('$ ') ? 'text-teal' : ''}`}>{l}</div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-[#0b0f14] px-3 py-2">
              <span className="font-mono text-sm text-teal">$</span>
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                placeholder="ex: pkg install ffmpeg -y   |   npm install   |   node index.js"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="flex-1 bg-transparent font-mono text-[13px] text-[#c9d1d9] placeholder:text-[#6e7681] focus:outline-none"
              />
              <button onClick={sendCommand} className="btn-primary !px-3 !py-1 text-xs">Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* File editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="truncate font-mono text-sm font-semibold">{editing.path}</h2>
              <button onClick={() => setEditing(null)} className="text-muted hover:text-ink"><i className="fa-solid fa-xmark" /></button>
            </div>
            <textarea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              spellCheck={false}
              className="field mt-4 min-h-[50vh] flex-1 font-mono text-xs"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="btn-ghost">Fechar</button>
              <button onClick={saveFile} disabled={savingFile} className="btn-primary">{savingFile ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
