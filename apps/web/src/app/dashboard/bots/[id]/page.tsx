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
  config?: { startCommand?: string; workdir?: string } | null;
}
interface FileNode {
  path: string;
  type: 'file' | 'dir';
  size: number;
}
interface Group {
  id?: string;
  name: string;
  description?: string;
  admins?: string[];
  services?: string[];
  participants?: number;
  plan?: string;
  active?: boolean;
  validUntil?: string;
  manual?: boolean;
}

const STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  connected: { label: 'A correr', chip: 'bg-teal/10 text-teal border border-teal/25', dot: 'bg-teal' },
  starting: { label: 'A iniciar', chip: 'bg-gold/10 text-gold border border-gold/25', dot: 'bg-gold' },
  stopped: { label: 'Parado', chip: 'bg-hover text-muted border border-line', dot: 'bg-muted2' },
  error: { label: 'Erro', chip: 'bg-danger/10 text-danger border border-danger/25', dot: 'bg-danger' },
};
const st = (s: string) => STATUS[s] || STATUS.stopped;

function fmtUptime(ms: number): string {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
function fmtAgo(ts: number): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}m`;
  return `há ${Math.floor(s / 3600)}h`;
}

export default function BotConsolePage() {
  const { user, loading } = useAuth('TENANT');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [status, setStatus] = useState('stopped');
  const [stats, setStats] = useState<{ uptimeMs: number; restarts: number; lastActivity: number; running: boolean } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [cmd, setCmd] = useState('');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [startCmd, setStartCmd] = useState('');
  const [workdir, setWorkdir] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [scriptOpen, setScriptOpen] = useState(false);
  const [script, setScript] = useState('');
  const [runningScript, setRunningScript] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState('');
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const [creator, setCreator] = useState<{ type: 'comando' | 'nano'; name: string; path: string; content: string } | null>(null);
  const [savingCreator, setSavingCreator] = useState(false);
  const [groupForm, setGroupForm] = useState<{ id: string; name: string; plan: string; validUntil: string } | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);
  const cmdHistory = useRef<string[]>([]);

  async function loadBot() {
    const res = await authApi.get(`/bots/${id}`);
    setBot(res.data);
    setStartCmd(res.data?.config?.startCommand || '');
    setWorkdir(res.data?.config?.workdir || '');
    setNameVal(res.data?.name || '');
  }

  async function saveName() {
    const name = nameVal.trim();
    if (!name) return;
    try {
      await authApi.patch(`/bots/${id}`, { name });
      setEditingName(false);
      await loadBot();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível guardar o nome');
    }
  }

  async function clearTerminal() {
    setLogs([]);
    try {
      await authApi.post(`/bots/${id}/logs/clear`);
    } catch {
      /* ignore */
    }
  }

  async function saveStartConfig() {
    setSavingCfg(true);
    try {
      const config = { ...(bot?.config || {}), startCommand: startCmd.trim(), workdir: workdir.trim() };
      await authApi.patch(`/bots/${id}`, { config });
      await loadBot();
      alert('Arranque guardado. Reinicia o bot para aplicar.');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível guardar');
    } finally {
      setSavingCfg(false);
    }
  }
  async function loadLive() {
    try {
      const res = await authApi.get(`/bots/${id}/live`);
      setStatus(res.data.status);
      setLogs(res.data.logs || []);
      setStats(res.data.stats || null);
      setGroups(res.data.groups || []);
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
    authApi.get('/account/api-keys').then((r) => setApiKey(r.data?.[0]?.key || '')).catch(() => {});
    const iv = setInterval(loadLive, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  async function downloadProject() {
    try {
      const res = await authApi.get(`/bots/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bot-${bot?.name || id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Não foi possível descarregar. Carrega um projeto primeiro.');
    }
  }

  // Only auto-scroll to the newest line when the user is already near the
  // bottom — so scrolling up to read isn't yanked back down by the 2s poll.
  useEffect(() => {
    if (autoScroll.current && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  function onLogsScroll() {
    const el = logsRef.current;
    if (!el) return;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

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
      setLogs((prev) => [...prev, `✅ ZIP carregado: ${file.name} (${Math.round(file.size / 1024)} KB). Inicia/Reinicia para correr.`]);
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
      setLogs((prev) => [...prev, `✅ ${res.data?.count ?? 0} ficheiro(s) carregado(s).`]);
      alert(`${res.data?.count ?? 0} ficheiro(s) carregado(s).`);
      await loadBot();
      loadFiles();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha no upload');
    } finally {
      setBusy('');
    }
  }

  function toggleDir(p: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  }
  // A node is visible only when every ancestor folder is expanded (manual navigation).
  function isVisible(path: string) {
    const segs = path.split('/');
    for (let i = 0; i < segs.length - 1; i++) {
      if (!expanded.has(segs.slice(0, i + 1).join('/'))) return false;
    }
    return true;
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
      setLogs((prev) => [...prev, `✅ Ficheiro atualizado: ${editing.path}. Reinicia o bot para carregar as alterações.`]);
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

  // Run a multi-line script/heredoc block (e.g. cat > src/file.js <<'EOF' … EOF)
  // to update code directly from the panel.
  async function runScript() {
    const s = script.trim();
    if (!s) return;
    setRunningScript(true);
    setLogs((prev) => [...prev, '$ (script)', ...s.split('\n').map((l) => '  ' + l)]);
    try {
      const res = await authApi.post(`/bots/${id}/command`, { command: s });
      if (res.data?.success === false) {
        setLogs((prev) => [...prev, res.data.message || 'O bot precisa de estar a correr.']);
      }
      setTimeout(loadFiles, 1500);
    } catch {
      /* ignore */
    } finally {
      setRunningScript(false);
    }
  }

  function openCreator(type: 'comando' | 'nano') {
    if (type === 'comando') {
      setCreator({
        type,
        name: '',
        path: 'src/comandos/novo.js',
        content: `// Comando: novo
module.exports = {
  name: 'novo',
  aliases: [],
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    await sock.sendMessage(jid, { text: 'Olá! Comando "novo" a funcionar.' });
  },
};
`,
      });
    } else {
      setCreator({
        type,
        name: '',
        path: 'storage/nanos/novo.json',
        content: `{
  "nome": "novo",
  "ativo": true,
  "gatilho": "!novo",
  "resposta": "Resposta automática do nano."
}
`,
      });
    }
  }

  function updateCreatorName(name: string) {
    if (!creator) return;
    const safe = name.trim().replace(/[^\w.-]/g, '_');
    const ext = creator.type === 'comando' ? 'js' : 'json';
    const folder = creator.type === 'comando' ? 'src/comandos' : 'storage/nanos';
    setCreator({ ...creator, name, path: safe ? `${folder}/${safe}.${ext}` : creator.path });
  }

  async function saveCreator() {
    if (!creator) return;
    setSavingCreator(true);
    try {
      await authApi.post(`/bots/${id}/file`, { path: creator.path, content: creator.content });
      setLogs((prev) => [...prev, `✅ ${creator.type === 'comando' ? 'Comando' : 'Nano'} criado: ${creator.path}. Reinicia o bot para carregar.`]);
      setCreator(null);
      loadFiles();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível criar');
    } finally {
      setSavingCreator(false);
    }
  }

  async function saveGroup() {
    if (!groupForm?.id.trim()) return;
    setSavingGroup(true);
    try {
      await authApi.post(`/bots/${id}/groups`, {
        id: groupForm.id.trim(),
        name: groupForm.name.trim() || undefined,
        plan: groupForm.plan.trim() || undefined,
        validUntil: groupForm.validUntil || undefined,
      });
      setGroupForm(null);
      await loadLive();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível adicionar');
    } finally {
      setSavingGroup(false);
    }
  }
  async function removeGroup(gid?: string) {
    if (!gid || !confirm('Remover este grupo do painel?')) return;
    await authApi.delete(`/bots/${id}/groups/${encodeURIComponent(gid)}`);
    await loadLive();
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

      {/* Editable name */}
      <div className="mb-5 flex items-center gap-2">
        {editingName ? (
          <>
            <input
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              autoFocus
              className="field max-w-xs font-display text-xl font-bold"
            />
            <button onClick={saveName} className="btn-primary !px-3 !py-1.5 text-sm">Guardar</button>
            <button onClick={() => { setEditingName(false); setNameVal(bot.name); }} className="btn-ghost !px-3 !py-1.5 text-sm">Cancelar</button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold">{bot.name}</h2>
            <button onClick={() => setEditingName(true)} className="text-muted transition hover:text-teal" title="Editar nome"><i className="fa-solid fa-pen text-sm" /></button>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`chip ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
          <span className="text-sm text-muted">{bot.type === 'manual' ? 'Manual (projeto Node/Baileys)' : 'Automático (MacroDroid)'}</span>
          {bot.type === 'manual' && stats && stats.running && (
            <>
              <span className="chip border border-line bg-hover text-muted" title="Tempo a correr"><i className="fa-regular fa-clock mr-1" />{fmtUptime(stats.uptimeMs)}</span>
              {stats.restarts > 0 && (
                <span className="chip border border-gold/25 bg-gold/10 text-gold" title="Reinícios automáticos"><i className="fa-solid fa-rotate mr-1" />{stats.restarts}</span>
              )}
              <span className="chip border border-line bg-hover text-muted" title="Última atividade"><i className="fa-solid fa-wave-square mr-1" />{fmtAgo(stats.lastActivity)}</span>
            </>
          )}
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
        <>
        {/* Start configuration */}
        <div className="card mb-5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <i className="fa-solid fa-play text-teal" />
            <span className="font-display text-sm font-semibold">Arranque</span>
            <span className="text-xs text-muted">— indica o ficheiro que põe o bot a rodar (ele não adivinha)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Ficheiro / comando de arranque</span>
              <input
                value={startCmd}
                onChange={(e) => setStartCmd(e.target.value)}
                placeholder="ex: index.js   ou   npm start   ou   node meu-bot.js"
                spellCheck={false}
                className="field font-mono text-xs"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Subpasta do projeto (opcional)</span>
              <input
                value={workdir}
                onChange={(e) => setWorkdir(e.target.value)}
                placeholder="ex: base-bot   (deixa vazio p/ deteção automática)"
                spellCheck={false}
                className="field font-mono text-xs"
              />
            </label>
            <button onClick={saveStartConfig} disabled={savingCfg} className="btn-primary whitespace-nowrap">
              {savingCfg ? 'A guardar…' : 'Guardar arranque'}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Se deixares vazio, o sistema tenta encontrar o package.json / index.js sozinho (mesmo dentro de uma subpasta). Se renomeaste o ficheiro, escreve aqui o nome. Reinicia o bot depois de guardar.
          </p>
        </div>

        {/* Panel API credentials — for the bot to talk back to HostAgente */}
        <div className="card mb-5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <i className="fa-solid fa-plug text-teal" />
            <span className="font-display text-sm font-semibold">Ligar o bot ao painel</span>
            <span className="text-xs text-muted">— usa estes valores no teu bot (PAINEL_API_URL / KEY / BOT_ID)</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <CredField label="BOT_ID" value={id} onCopy={() => copy(id, 'id')} copied={copied === 'id'} />
            <CredField label="API_URL" value={apiBase} onCopy={() => copy(apiBase, 'url')} copied={copied === 'url'} />
            <CredField label="API_KEY" value={apiKey} secret onCopy={() => copy(apiKey, 'key')} copied={copied === 'key'} />
          </div>
          <div className="mt-3 rounded-lg bg-[#0b0f14] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted">Variáveis de ambiente</span>
              <button
                onClick={() => copy(`export PAINEL_API_URL=${apiBase}\nexport PAINEL_API_KEY=${apiKey}\nexport PAINEL_BOT_ID=${id}`, 'env')}
                className="text-xs text-teal hover:underline"
              >
                {copied === 'env' ? 'copiado ✓' : 'copiar tudo'}
              </button>
            </div>
            <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-[#c9d1d9]">{`export PAINEL_API_URL=${apiBase || 'http://SEU_IP:3000'}
export PAINEL_API_KEY=${apiKey || 'a-tua-chave'}
export PAINEL_BOT_ID=${id}`}</pre>
          </div>
          <p className="mt-2 text-xs text-muted">
            A API key é a mesma de <Link href="/dashboard/account" className="text-teal hover:underline">Conta &amp; API</Link>. Endpoints do bot: <span className="font-mono">/bot-api/products</span>, <span className="font-mono">/bot-api/bots/{'{id}'}/groups</span>, <span className="font-mono">/bot-api/bots/{'{id}'}/info</span>.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* File manager */}
          <div className="card flex max-h-[600px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="font-display text-sm font-semibold"><i className="fa-solid fa-folder-tree mr-2 text-teal" />Ficheiros</span>
              <div className="flex items-center gap-3">
                <button onClick={downloadProject} className="text-xs text-muted hover:text-teal" title="Descarregar projeto (.zip)"><i className="fa-solid fa-download" /></button>
                <button onClick={loadFiles} className="text-xs text-muted hover:text-ink" title="Atualizar"><i className="fa-solid fa-rotate" /></button>
              </div>
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
              <button onClick={() => openCreator('comando')} className="btn-ghost !px-2.5 !py-1 text-xs" title="Criar comando">
                <i className="fa-solid fa-terminal" /> Comando
              </button>
              <button onClick={() => openCreator('nano')} className="btn-ghost !px-2.5 !py-1 text-xs" title="Criar nano">
                <i className="fa-solid fa-cube" /> Nano
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 text-sm">
              {busy === 'upload' && <p className="px-2 py-3 text-xs text-teal">A carregar…</p>}
              {files.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted">Sem ficheiros. Carrega um ZIP, ficheiros ou uma pasta.</p>
              ) : (
                files.filter((f) => isVisible(f.path)).map((f) => {
                  const segs = f.path.split('/');
                  const depth = segs.length - 1;
                  const name = segs[segs.length - 1];
                  const isDir = f.type === 'dir';
                  const isOpen = expanded.has(f.path);
                  return (
                    <div key={f.path} className="group flex items-center gap-1 rounded px-1.5 py-1 hover:bg-hover" style={{ paddingLeft: 6 + depth * 12 }}>
                      {isDir ? (
                        <button onClick={() => toggleDir(f.path)} className="flex flex-1 items-center gap-1.5 truncate text-left">
                          <i className={`fa-solid fa-chevron-right w-3 text-[9px] text-muted transition ${isOpen ? 'rotate-90' : ''}`} />
                          <i className={`fa-solid ${isOpen ? 'fa-folder-open' : 'fa-folder'} w-4 text-xs text-gold`} />
                          <span className="truncate text-xs text-ink">{name}</span>
                        </button>
                      ) : (
                        <button onClick={() => openFile(f.path)} className="flex flex-1 items-center gap-1.5 truncate text-left">
                          <span className="w-3" />
                          <i className="fa-solid fa-file w-4 text-xs text-muted" />
                          <span className="truncate text-xs text-ink hover:text-teal">{name}</span>
                        </button>
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
              <button onClick={clearTerminal} className="text-xs text-muted hover:text-ink"><i className="fa-solid fa-eraser mr-1" />limpar</button>
            </div>
            <div ref={logsRef} onScroll={onLogsScroll} className="flex-1 overflow-y-auto bg-[#0b0f14] p-4 font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
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
              <button onClick={() => setScriptOpen((o) => !o)} className="btn-ghost !px-3 !py-1 text-xs" title="Script multi-linha / EOF">
                <i className="fa-solid fa-code" />
              </button>
            </div>
          </div>
        </div>

        {/* Multi-line script / EOF runner — update code directly */}
        {scriptOpen && (
          <div className="mt-4 card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-display text-sm font-semibold"><i className="fa-solid fa-scroll mr-2 text-teal" />Atualizar por script (EOF)</span>
              <button onClick={() => setScriptOpen(false)} className="text-xs text-muted hover:text-ink"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="p-3">
              <p className="mb-2 text-xs text-muted">
                Cola um bloco de comandos (aceita heredoc/EOF) para atualizar ficheiros ou instalar dependências sem sair do painel. Corre na pasta do projeto.
              </p>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                spellCheck={false}
                placeholder={"cat > src/comandos/novo.js <<'EOF'\nmodule.exports = () => { /* nova funcionalidade */ };\nEOF\nnpm install dayjs"}
                className="w-full min-h-[160px] rounded-lg bg-[#0b0f14] p-3 font-mono text-[13px] text-[#c9d1d9] placeholder:text-[#6e7681] focus:outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setScript('')} className="btn-ghost !py-1.5 text-xs">Limpar</button>
                <button onClick={runScript} disabled={runningScript} className="btn-primary !py-1.5 text-xs">
                  {runningScript ? 'A correr…' : 'Correr script'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp groups */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold"><i className="fa-brands fa-whatsapp mr-2 text-teal" />Grupos do WhatsApp</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {groups.length > 0 && (
                <>
                  <span className="chip border border-line bg-hover text-muted">{groups.length} grupo(s)</span>
                  <span className="chip border border-line bg-hover text-muted">
                    {groups.reduce((n, g) => n + (g.services?.length || 0), 0)} serviço(s)
                  </span>
                  {groups.some((g) => g.active !== undefined) && (
                    <span className="chip border border-teal/25 bg-teal/10 text-teal">
                      {groups.filter((g) => g.active).length} assinatura(s) ativa(s)
                    </span>
                  )}
                </>
              )}
              <button onClick={() => setGroupForm({ id: '', name: '', plan: '', validUntil: '' })} className="btn-primary !px-3 !py-1 text-xs">
                <i className="fa-solid fa-plus" /> Adicionar grupo
              </button>
            </div>
          </div>

          {/* Add-group form */}
          {groupForm && (
            <div className="card mb-4 p-4">
              <p className="mb-3 text-sm text-muted">Regista um grupo pelo <b>ID</b> (o bot completa nome, admins e serviços quando ligar). Define o plano e a validade da subscrição.</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted">ID do grupo *</span>
                  <input value={groupForm.id} onChange={(e) => setGroupForm({ ...groupForm, id: e.target.value })} placeholder="120363428003039805" className="field font-mono text-xs" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Nome (opcional)</span>
                  <input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="TESTE confidencial" className="field text-sm" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Plano</span>
                  <input value={groupForm.plan} onChange={(e) => setGroupForm({ ...groupForm, plan: e.target.value })} placeholder="PRO" className="field text-sm" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Validade da subscrição</span>
                  <input type="date" value={groupForm.validUntil} onChange={(e) => setGroupForm({ ...groupForm, validUntil: e.target.value })} className="field text-sm" />
                </label>
                <button onClick={saveGroup} disabled={savingGroup || !groupForm.id.trim()} className="btn-primary">{savingGroup ? 'A guardar…' : 'Guardar grupo'}</button>
                <button onClick={() => setGroupForm(null)} className="btn-ghost">Cancelar</button>
              </div>
            </div>
          )}
          {groups.length === 0 ? (
            <div className="card p-6 text-center">
              <i className="fa-solid fa-people-group text-2xl text-muted2" />
              <p className="mt-2 text-sm text-muted">Sem grupos ainda. Quando o bot ligar ao WhatsApp e reportar os grupos, aparecem aqui — nome, descrição, admins e serviços ativos de cada grupo.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g, i) => (
                <div key={g.id || i} className={`group card flex flex-col p-5 transition hover:border-teal/30 ${g.active === false ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><i className="fa-solid fa-users" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold" title={g.name}>{g.name}</p>
                      {g.id && <p className="truncate font-mono text-[10px] text-muted2" title={g.id}>{g.id}</p>}
                      {typeof g.participants === 'number' && (
                        <p className="text-xs text-muted">{g.participants} participantes</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {g.active !== undefined && (
                        <span className={`chip ${g.active ? 'bg-teal/10 text-teal border border-teal/25' : 'bg-danger/10 text-danger border border-danger/25'}`}>
                          {g.active ? 'Ativa' : 'Inativa'}
                        </span>
                      )}
                      {g.manual && (
                        <button onClick={() => removeGroup(g.id)} className="text-xs text-muted opacity-0 transition hover:text-danger group-hover:opacity-100" title="Remover"><i className="fa-solid fa-xmark" /></button>
                      )}
                    </div>
                  </div>
                  {(g.plan || g.validUntil) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {g.plan && <span className="chip border border-gold/25 bg-gold/10 text-gold"><i className="fa-solid fa-star mr-1" />Plano {g.plan}</span>}
                      {g.validUntil && (
                        <span className={`chip border ${g.active === false ? 'border-danger/25 bg-danger/10 text-danger' : 'border-line bg-hover text-muted'}`}>
                          <i className="fa-regular fa-calendar mr-1" />até {new Date(g.validUntil).toLocaleDateString('pt-PT')}
                        </span>
                      )}
                    </div>
                  )}
                  {g.description && <p className="mt-3 line-clamp-3 text-sm text-muted">{g.description}</p>}

                  {g.services && g.services.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted2">Serviços ativos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.services.map((sv, j) => (
                          <span key={j} className="chip border border-teal/25 bg-teal/10 text-teal">{sv}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {g.admins && g.admins.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted2">Administradores</p>
                      <div className="space-y-1">
                        {g.admins.map((a, j) => (
                          <p key={j} className="flex items-center gap-2 text-sm text-muted"><i className="fa-solid fa-user-shield text-xs text-gold" />{a}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}

      {/* Command / Nano creator */}
      {creator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCreator(null)}>
          <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                <i className={`fa-solid ${creator.type === 'comando' ? 'fa-terminal' : 'fa-cube'} mr-2 text-teal`} />
                Criar {creator.type === 'comando' ? 'comando' : 'nano'}
              </h2>
              <button onClick={() => setCreator(null)} className="text-muted hover:text-ink"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-muted">Nome</span>
                <input value={creator.name} onChange={(e) => updateCreatorName(e.target.value)} placeholder="ex: saldo" className="field text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Caminho do ficheiro</span>
                <input value={creator.path} onChange={(e) => setCreator({ ...creator, path: e.target.value })} className="field font-mono text-xs" />
              </label>
            </div>
            <label className="mt-3 flex-1 text-sm">
              <span className="mb-1 block text-muted">Conteúdo</span>
              <textarea value={creator.content} onChange={(e) => setCreator({ ...creator, content: e.target.value })} spellCheck={false} className="field min-h-[280px] w-full font-mono text-xs" />
            </label>
            <p className="mt-2 text-xs text-muted">Ajusta o caminho à estrutura do teu bot. Reinicia o bot depois de criar para carregar.</p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setCreator(null)} className="btn-ghost">Cancelar</button>
              <button onClick={saveCreator} disabled={savingCreator || !creator.path} className="btn-primary">{savingCreator ? 'A criar…' : 'Criar'}</button>
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

function CredField({ label, value, secret, onCopy, copied }: { label: string; value: string; secret?: boolean; onCopy: () => void; copied: boolean }) {
  const shown = secret && value ? value.slice(0, 6) + '••••••' + value.slice(-4) : value;
  return (
    <div className="rounded-lg border border-line bg-hover px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted2">{label}</p>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={value}>{shown || '—'}</span>
        <button onClick={onCopy} className="shrink-0 text-xs text-teal hover:text-teal-dark" title="Copiar">
          <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
        </button>
      </div>
    </div>
  );
}
