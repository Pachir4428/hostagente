'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

type Kind = 'comando' | 'nano' | 'menu' | 'autoreply';

const KINDS: { id: Kind; label: string; icon: string; ext: 'js' | 'json' }[] = [
  { id: 'comando', label: 'Comando Baileys', icon: 'fa-terminal', ext: 'js' },
  { id: 'nano', label: 'Nano (auto-resposta)', icon: 'fa-cube', ext: 'json' },
  { id: 'menu', label: 'Menu', icon: 'fa-list', ext: 'js' },
  { id: 'autoreply', label: 'Resposta automática', icon: 'fa-reply', ext: 'js' },
];

function build(kind: Kind, trigger: string, response: string, options: string): string {
  const t = (trigger || 'ping').trim().replace(/^[!./]/, '');
  const r = (response || 'Olá! 👋').replace(/`/g, '\\`');
  if (kind === 'nano') {
    return JSON.stringify({ gatilho: '!' + t, resposta: response || 'Olá! 👋', ativo: true }, null, 2);
  }
  if (kind === 'menu') {
    const items = (options || 'Recarga\nPacotes\nComprovante')
      .split('\n')
      .map((o, i) => `▸ ${i + 1}. ${o.trim()}`)
      .filter(Boolean)
      .join('\\n');
    return `// Comando: menu
module.exports = {
  name: 'menu',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const menu = \`📋 *MENU*\\n\\n${items}\\n\\nResponde com o número.\`;
    await sock.sendMessage(jid, { text: menu });
  },
};
`;
  }
  if (kind === 'autoreply') {
    return `// Resposta automática quando a mensagem contém "${t}"
module.exports = {
  match: (text) => text.toLowerCase().includes('${t.toLowerCase()}'),
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    await sock.sendMessage(jid, { text: \`${r}\` });
  },
};
`;
  }
  // comando
  return `// Comando: !${t}
module.exports = {
  name: '${t}',
  aliases: [],
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    await sock.sendMessage(jid, { text: \`${r}\` });
  },
};
`;
}

export function CodeGenerator({ gated = false, freeUses = 2, canSave = false }: { gated?: boolean; freeUses?: number; canSave?: boolean }) {
  const [kind, setKind] = useState<Kind>('comando');
  const [trigger, setTrigger] = useState('saldo');
  const [response, setResponse] = useState('Envia o comprovante para confirmar o teu saldo. 💳');
  const [options, setOptions] = useState('Recarga\nPacotes diários\nComprovante');
  const [output, setOutput] = useState('');
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bots, setBots] = useState<{ id: string; name: string }[]>([]);
  const [saveBot, setSaveBot] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (canSave) authApi.get('/bots').then((r) => setBots((r.data || []).filter((b: any) => b.type === 'manual'))).catch(() => {});
  }, [canSave]);

  async function saveToBot() {
    if (!saveBot || !output) return;
    const ext = KINDS.find((k) => k.id === kind)?.ext || 'js';
    const folder = ext === 'json' ? 'storage/nanos' : 'src/comandos';
    const name = (trigger || 'codigo').trim().replace(/[^\w.-]/g, '_');
    const path = `${folder}/${name}.${ext}`;
    setSaving(true);
    try {
      await authApi.post(`/bots/${saveBot}/file`, { path, content: output });
      alert(`Guardado em ${path}. Reinicia o bot para carregar.`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível guardar');
    } finally {
      setSaving(false);
    }
  }

  function generate() {
    if (gated) {
      const used = Number(localStorage.getItem('gen_uses') || '0');
      if (used >= freeUses) {
        setLocked(true);
        setOutput('');
        return;
      }
      localStorage.setItem('gen_uses', String(used + 1));
    }
    setOutput(build(kind, trigger, response, options));
    setLocked(false);
  }

  function copy() {
    navigator.clipboard?.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  function download() {
    const ext = KINDS.find((k) => k.id === kind)?.ext || 'js';
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trigger || 'codigo'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Controls */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${kind === k.id ? 'border-teal/40 bg-teal/10 text-teal' : 'border-line text-muted hover:bg-hover'}`}
            >
              <i className={`fa-solid ${k.icon} mr-1`} />{k.label}
            </button>
          ))}
        </div>

        {kind !== 'menu' && (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">{kind === 'autoreply' ? 'Palavra que ativa' : 'Gatilho (comando)'}</span>
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="saldo" className="field text-sm" />
          </label>
        )}
        {kind === 'menu' ? (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">Opções do menu (uma por linha)</span>
            <textarea value={options} onChange={(e) => setOptions(e.target.value)} className="field min-h-[110px] text-sm" />
          </label>
        ) : (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">Resposta</span>
            <textarea value={response} onChange={(e) => setResponse(e.target.value)} className="field min-h-[90px] text-sm" />
          </label>
        )}
        <button onClick={generate} className="btn-primary w-full"><i className="fa-solid fa-wand-magic-sparkles" /> Gerar código</button>
      </div>

      {/* Output */}
      <div className="card flex flex-col p-5">
        {locked ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/10 text-2xl text-teal"><i className="fa-solid fa-lock" /></span>
            <p className="mt-4 font-display text-lg font-semibold">Gostaste? Cria conta para continuar</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Usaste as gerações grátis. Com uma conta grátis geras sem limite <b>e hospedas os teus bots</b> — QR, terminal, grupos e pagamentos automáticos.</p>
            <Link href="/register" className="btn-primary mt-5">Criar conta grátis →</Link>
            <Link href="/login" className="mt-2 text-xs text-muted hover:text-ink">Já tenho conta</Link>
          </div>
        ) : output ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted">Código gerado</span>
              <div className="flex gap-3 text-xs">
                <button onClick={copy} className="text-teal hover:underline">{copied ? 'copiado ✓' : 'copiar'}</button>
                <button onClick={download} className="text-teal hover:underline">descarregar</button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto rounded-lg bg-[#0b0f14] p-3 font-mono text-[12px] leading-relaxed text-[#c9d1d9]">{output}</pre>
            {canSave && bots.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="text-xs text-muted">Guardar num bot:</span>
                <select value={saveBot} onChange={(e) => setSaveBot(e.target.value)} className="field !py-1.5 text-sm">
                  <option value="">Escolhe…</option>
                  {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button onClick={saveToBot} disabled={!saveBot || saving} className="btn-primary !px-3 !py-1.5 text-xs">
                  {saving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">
            <span><i className="fa-solid fa-arrow-left mr-1" /> Configura e clica em <b>Gerar código</b>.</span>
          </div>
        )}
      </div>
    </div>
  );
}
