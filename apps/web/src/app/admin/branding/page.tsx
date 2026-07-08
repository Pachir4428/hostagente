'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { applyBranding } from '@/lib/branding';

interface Feature {
  icon?: string;
  title?: string;
  desc?: string;
}
interface Branding {
  appName?: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  landing?: {
    badge?: string;
    heroTitle?: string;
    heroHighlight?: string;
    heroSubtitle?: string;
    ctaText?: string;
    features?: Feature[];
    footerNote?: string;
  };
}

function readFileAsDataUrl(file: File, maxKB: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxKB * 1024) {
      reject(new Error(`Ficheiro demasiado grande (máx ${maxKB}KB).`));
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Falha a ler o ficheiro'));
    r.readAsDataURL(file);
  });
}

export default function AdminBrandingPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [b, setB] = useState<Branding>({ landing: {} });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const res = await authApi.get('/admin/settings');
    setB(res.data.branding || { landing: {} });
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function setLanding(k: string, v: any) {
    setB((prev) => ({ ...prev, landing: { ...(prev.landing || {}), [k]: v } }));
  }
  function setFeature(i: number, k: keyof Feature, v: string) {
    setB((prev) => {
      const fs = [...((prev.landing?.features as Feature[]) || [])];
      fs[i] = { ...fs[i], [k]: v };
      return { ...prev, landing: { ...(prev.landing || {}), features: fs } };
    });
  }
  function addFeature() {
    setB((prev) => ({ ...prev, landing: { ...(prev.landing || {}), features: [...((prev.landing?.features as Feature[]) || []), { icon: '✨', title: '', desc: '' }] } }));
  }
  function removeFeature(i: number) {
    setB((prev) => ({ ...prev, landing: { ...(prev.landing || {}), features: ((prev.landing?.features as Feature[]) || []).filter((_, x) => x !== i) } }));
  }

  async function upload(kind: 'logo' | 'favicon', file?: File) {
    if (!file) return;
    try {
      const data = await readFileAsDataUrl(file, kind === 'logo' ? 500 : 150);
      setB((prev) => ({ ...prev, [kind]: data }));
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await authApi.put('/admin/settings/branding', b);
      setB(res.data);
      applyBranding(res.data); // live-apply for this admin immediately
      setMsg('Marca guardada. Os visitantes verão as alterações ao recarregar.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível guardar');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <AppShell nav={ADMIN_NAV} title="Marca & Landing" email={user?.email}>
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      </AppShell>
    );
  }

  const L = b.landing || {};

  return (
    <AppShell nav={ADMIN_NAV} title="Marca & Landing" email={user.email}>
      {msg && <div className="mb-4 rounded-xl border border-teal/25 bg-teal/10 px-4 py-2.5 text-sm text-teal">{msg}</div>}

      {/* Identity */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold">Identidade</h2>
        <div className="card grid max-w-2xl gap-4 p-5">
          <Field label="Nome da aplicação" value={b.appName || ''} onChange={(v) => setB({ ...b, appName: v })} placeholder="HostAgente" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm text-muted">Logótipo (PNG/SVG, máx 500KB)</span>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-line bg-hover">
                  {b.logo ? <img src={b.logo} alt="logo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted">—</span>}
                </div>
                <label className="btn-ghost cursor-pointer text-sm">
                  Carregar<input type="file" accept="image/*" className="hidden" onChange={(e) => upload('logo', e.target.files?.[0])} />
                </label>
                {b.logo && <button onClick={() => setB({ ...b, logo: '' })} className="text-xs text-muted hover:text-danger">remover</button>}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm text-muted">Favicon (máx 150KB)</span>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-line bg-hover">
                  {b.favicon ? <img src={b.favicon} alt="favicon" className="h-8 w-8 object-contain" /> : <span className="text-xs text-muted">—</span>}
                </div>
                <label className="btn-ghost cursor-pointer text-sm">
                  Carregar<input type="file" accept="image/*" className="hidden" onChange={(e) => upload('favicon', e.target.files?.[0])} />
                </label>
                {b.favicon && <button onClick={() => setB({ ...b, favicon: '' })} className="text-xs text-muted hover:text-danger">remover</button>}
              </div>
            </div>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Cor principal</span>
            <div className="flex items-center gap-3">
              <input type="color" value={b.primaryColor || '#22D3AA'} onChange={(e) => setB({ ...b, primaryColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded border border-line bg-transparent" />
              <input value={b.primaryColor || ''} onChange={(e) => setB({ ...b, primaryColor: e.target.value })} placeholder="#22D3AA" className="field font-mono text-sm" />
            </div>
          </label>
        </div>
      </section>

      {/* Landing content */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold">Página inicial (landing)</h2>
        <div className="card grid max-w-2xl gap-3 p-5">
          <Field label="Etiqueta (badge)" value={L.badge || ''} onChange={(v) => setLanding('badge', v)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título" value={L.heroTitle || ''} onChange={(v) => setLanding('heroTitle', v)} placeholder="Vende dados no" />
            <Field label="Palavra em destaque" value={L.heroHighlight || ''} onChange={(v) => setLanding('heroHighlight', v)} placeholder="automático" />
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Subtítulo</span>
            <textarea value={L.heroSubtitle || ''} onChange={(e) => setLanding('heroSubtitle', e.target.value)} className="field min-h-[80px] text-sm" />
          </label>
          <Field label="Texto do botão" value={L.ctaText || ''} onChange={(v) => setLanding('ctaText', v)} placeholder="Criar conta grátis" />
          <Field label="Rodapé" value={L.footerNote || ''} onChange={(v) => setLanding('footerNote', v)} />
        </div>
      </section>

      {/* Features */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Funcionalidades (cartões)</h2>
          <button onClick={addFeature} className="btn-ghost text-sm"><i className="fa-solid fa-plus" /> Adicionar</button>
        </div>
        <div className="grid max-w-2xl gap-3">
          {((L.features as Feature[]) || []).length === 0 && (
            <p className="card p-4 text-sm text-muted">Sem cartões personalizados — a landing usa os predefinidos. Adiciona para substituir.</p>
          )}
          {((L.features as Feature[]) || []).map((f, i) => (
            <div key={i} className="card grid gap-2 p-4 sm:grid-cols-[60px_1fr_auto] sm:items-start">
              <input value={f.icon || ''} onChange={(e) => setFeature(i, 'icon', e.target.value)} placeholder="⚡" className="field text-center" />
              <div className="grid gap-2">
                <input value={f.title || ''} onChange={(e) => setFeature(i, 'title', e.target.value)} placeholder="Título" className="field text-sm" />
                <input value={f.desc || ''} onChange={(e) => setFeature(i, 'desc', e.target.value)} placeholder="Descrição" className="field text-sm" />
              </div>
              <button onClick={() => removeFeature(i)} className="text-muted hover:text-danger" title="Remover"><i className="fa-solid fa-trash" /></button>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4">
        <button onClick={save} disabled={busy} className="btn-primary shadow-glow">{busy ? 'A guardar…' : 'Guardar marca & landing'}</button>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field text-sm" />
    </label>
  );
}
