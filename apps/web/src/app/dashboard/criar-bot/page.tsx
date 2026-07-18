'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';

interface GenFile {
  name: string;
  content: string;
}

type Base = 'modelo' | 'ponte' | 'vazio';

const BASES: { id: Base; label: string; desc: string; icon: string }[] = [
  { id: 'modelo', label: 'Bot-modelo', desc: 'Baileys pronto que já reporta grupos e estatísticas. Ideal para começar.', icon: 'fa-solid fa-robot' },
  { id: 'ponte', label: 'Ponte de pagamentos', desc: 'Lê comprovantes M-Pesa/e-Mola no WhatsApp e entrega automaticamente.', icon: 'fa-solid fa-money-bill-transfer' },
  { id: 'vazio', label: 'Vazio', desc: 'Só o essencial (index.js + package.json). Para quem quer construir do zero.', icon: 'fa-solid fa-file-code' },
];

export default function CriarBotPage() {
  const { user } = useAuth('TENANT');
  const router = useRouter();

  const [tab, setTab] = useState<'ia' | 'manual'>('ia');
  const [paid, setPaid] = useState<boolean | null>(null); // plano pago?

  // IA
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genFiles, setGenFiles] = useState<GenFile[]>([]);
  const [genSource, setGenSource] = useState<'ai' | 'fallback' | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);

  // Comum
  const [name, setName] = useState('');
  const [base, setBase] = useState<Base>('modelo');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    authApi
      .get('/subscription')
      .then((r) => setPaid((r.data?.plan?.priceMonthly ?? 0) > 0))
      .catch(() => setPaid(false));
  }, [user]);

  async function generate() {
    setError('');
    setGenerating(true);
    setGenFiles([]);
    try {
      const res = await authApi.post('/bots/ai-generate', { prompt: prompt.trim() });
      setGenFiles(res.data.files || []);
      setGenSource(res.data.source);
      setOpenFile(res.data.files?.[0]?.name || null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível gerar. Tenta de novo.');
    } finally {
      setGenerating(false);
    }
  }

  async function scaffold(extraFiles: GenFile[]) {
    if (!name.trim()) {
      setError('Dá um nome ao bot.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const res = await authApi.post('/bots/scaffold', {
        name: name.trim(),
        base,
        extraFiles,
      });
      router.push(`/dashboard/bots/${res.data.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível criar o bot.');
      setCreating(false);
    }
  }

  const aiLocked = paid === false;

  return (
    <AppShell nav={TENANT_NAV} title="Criar bot" email={user?.email}>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Cria um bot de WhatsApp do zero — descreve o que ele deve fazer e a IA gera os comandos, ou monta manualmente a partir de um modelo.
      </p>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-xl border border-line bg-hover p-1">
        <button
          onClick={() => setTab('ia')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'ia' ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          <i className="fa-solid fa-wand-magic-sparkles" /> Por IA
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'manual' ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          <i className="fa-solid fa-sliders" /> Manual
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Coluna principal */}
        <div className="space-y-6">
          {tab === 'ia' ? (
            aiLocked ? (
              <div className="card flex flex-col items-center px-6 py-14 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-2xl">
                  <i className="fa-solid fa-lock text-gold" />
                </div>
                <p className="mt-4 font-display text-lg font-semibold">Criador por IA — planos pagos</p>
                <p className="mt-1 max-w-sm text-sm text-muted">
                  A geração de comandos por inteligência artificial está disponível nos planos Pro e Business. Faz upgrade para desbloquear.
                </p>
                <a href="/dashboard/subscription" className="btn-primary mt-6">
                  <i className="fa-solid fa-star" /> Ver planos
                </a>
                <button onClick={() => setTab('manual')} className="mt-3 text-sm text-teal hover:underline">
                  Ou cria manualmente →
                </button>
              </div>
            ) : (
              <div className="card p-6">
                <label className="mb-1.5 block text-sm font-medium">Descreve o teu bot</label>
                <p className="mb-3 text-xs text-muted">
                  Ex: &ldquo;Um bot que responde ao !saldo com o saldo, ao !pacotes com a lista de pacotes de dados e ao !ajuda com o contacto de suporte.&rdquo;
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="field resize-none"
                  placeholder="O que o bot deve fazer…"
                />
                <button
                  onClick={generate}
                  disabled={generating || !prompt.trim()}
                  className="btn-primary mt-4"
                >
                  {generating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> A gerar…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles" /> Gerar comandos
                    </>
                  )}
                </button>

                {genFiles.length > 0 && (
                  <div className="mt-6 border-t border-line pt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {genFiles.length} ficheiro{genFiles.length > 1 ? 's' : ''} gerado{genFiles.length > 1 ? 's' : ''}
                      </p>
                      {genSource === 'fallback' && (
                        <span className="chip bg-gold/10 text-gold border border-gold/25">Modelo base (IA indisponível)</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {genFiles.map((f) => (
                        <button
                          key={f.name}
                          onClick={() => setOpenFile(openFile === f.name ? null : f.name)}
                          className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${openFile === f.name ? 'border-teal/40 bg-teal/10 text-teal' : 'border-line text-muted hover:text-ink'}`}
                        >
                          {f.name.replace('src/comandos/', '')}
                        </button>
                      ))}
                    </div>
                    {openFile && (
                      <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed">
                        <code>{genFiles.find((f) => f.name === openFile)?.content}</code>
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="card p-6">
              <p className="mb-1.5 text-sm font-medium">Escolhe uma base</p>
              <p className="mb-4 text-xs text-muted">O bot é criado a partir deste modelo. Podes editar todos os ficheiros depois na consola do bot.</p>
              <div className="space-y-3">
                {BASES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBase(b.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${base === b.id ? 'border-teal/40 bg-teal/5' : 'border-line hover:border-teal/25'}`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${base === b.id ? 'bg-teal/15 text-teal' : 'bg-hover text-muted'}`}>
                      <i className={b.icon} />
                    </div>
                    <div>
                      <p className="font-display font-semibold">{b.label}</p>
                      <p className="mt-0.5 text-xs text-muted">{b.desc}</p>
                    </div>
                    <span className={`ml-auto mt-1 grid h-5 w-5 place-items-center rounded-full border ${base === b.id ? 'border-teal bg-teal text-white' : 'border-line'}`}>
                      {base === b.id && <i className="fa-solid fa-check text-[10px]" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna: finalizar */}
        <div className="space-y-4">
          <div className="card p-6">
            <p className="font-display text-lg font-semibold">Finalizar</p>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm text-muted">Nome do bot</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Ex: Atendimento" />
            </div>

            {tab === 'manual' && (
              <p className="mt-3 text-xs text-muted">
                Base: <span className="font-medium text-ink">{BASES.find((b) => b.id === base)?.label}</span>
              </p>
            )}
            {tab === 'ia' && !aiLocked && (
              <p className="mt-3 text-xs text-muted">
                {genFiles.length > 0
                  ? `${genFiles.length} comando(s) da IA + base Bot-modelo.`
                  : 'Gera os comandos primeiro (ou cria só com o modelo base).'}
              </p>
            )}

            {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <button
              onClick={() => scaffold(tab === 'ia' ? genFiles : [])}
              disabled={creating || !name.trim() || (tab === 'ia' && aiLocked)}
              className="btn-primary mt-5 w-full justify-center"
            >
              {creating ? 'A criar…' : (
                <>
                  <i className="fa-solid fa-plus" /> Criar bot
                </>
              )}
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              O limite de bots depende do teu plano.
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-medium">Depois de criar</p>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li className="flex gap-2"><i className="fa-solid fa-1 mt-0.5 text-teal" /> Abre a consola do bot e liga ao WhatsApp por QR.</li>
              <li className="flex gap-2"><i className="fa-solid fa-2 mt-0.5 text-teal" /> Edita ou adiciona comandos no gestor de ficheiros.</li>
              <li className="flex gap-2"><i className="fa-solid fa-3 mt-0.5 text-teal" /> Inicia o bot e acompanha os logs em tempo real.</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
