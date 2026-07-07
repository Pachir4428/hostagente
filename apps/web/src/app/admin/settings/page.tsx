'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';

interface GatewayConfig {
  enabled?: boolean;
  number?: string;
  publicKey?: string;
  secretKey?: string;
  clientId?: string;
  clientSecret?: string;
  mode?: 'sandbox' | 'live';
}
interface Gateways {
  visa: GatewayConfig;
  paypal: GatewayConfig;
  mpesa: GatewayConfig;
  emola: GatewayConfig;
}
interface Assistant {
  provider?: 'anthropic' | 'openai';
  apiKey?: string;
  model?: string;
  enabled?: boolean;
}

const EMPTY: Gateways = {
  visa: {},
  paypal: {},
  mpesa: {},
  emola: {},
};

export default function AdminSettingsPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [gateways, setGateways] = useState<Gateways>(EMPTY);
  const [assistant, setAssistant] = useState<Assistant>({ provider: 'anthropic', enabled: true });
  const [savedMsg, setSavedMsg] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    const res = await authApi.get('/admin/settings');
    setGateways({ ...EMPTY, ...res.data.gateways });
    setAssistant(res.data.assistant || {});
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function flash(m: string) {
    setSavedMsg(m);
    setTimeout(() => setSavedMsg(''), 2500);
  }
  function patch(id: keyof Gateways, field: keyof GatewayConfig, value: any) {
    setGateways((g) => ({ ...g, [id]: { ...g[id], [field]: value } }));
  }

  async function saveGateways() {
    setBusy('gw');
    try {
      await authApi.put('/admin/settings/gateways', gateways);
      flash('Gateways guardados.');
    } finally {
      setBusy('');
    }
  }
  async function saveAssistant() {
    setBusy('ai');
    try {
      await authApi.put('/admin/settings/assistant', assistant);
      flash('Assistente guardado.');
    } finally {
      setBusy('');
    }
  }

  if (loading || !user) {
    return (
      <AppShell nav={ADMIN_NAV} title="Definições" email={user?.email}>
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      </AppShell>
    );
  }

  const cardMode = (id: keyof Gateways, opts: { number?: boolean; keys?: boolean; oauth?: boolean; icon: string; label: string }) => {
    const c = gateways[id];
    return (
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display font-semibold">
            <i className={`${opts.icon} text-teal`} /> {opts.label}
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={!!c.enabled} onChange={(e) => patch(id, 'enabled', e.target.checked)} />
            Ativo
          </label>
        </div>
        <div className="grid gap-3">
          {opts.number && (
            <Field label="Número que recebe" value={c.number || ''} onChange={(v) => patch(id, 'number', v)} placeholder="84xxxxxxx" />
          )}
          {opts.keys && (
            <>
              <Field label="Public key" value={c.publicKey || ''} onChange={(v) => patch(id, 'publicKey', v)} placeholder="pk_..." />
              <Field label="Secret key" value={c.secretKey || ''} onChange={(v) => patch(id, 'secretKey', v)} placeholder="sk_..." secret />
            </>
          )}
          {opts.oauth && (
            <>
              <Field label="Client ID" value={c.clientId || ''} onChange={(v) => patch(id, 'clientId', v)} />
              <Field label="Client secret" value={c.clientSecret || ''} onChange={(v) => patch(id, 'clientSecret', v)} secret />
            </>
          )}
          {(opts.keys || opts.oauth) && (
            <label className="text-sm">
              <span className="mb-1 block text-muted">Modo</span>
              <select className="field" value={c.mode || 'sandbox'} onChange={(e) => patch(id, 'mode', e.target.value as any)}>
                <option value="sandbox">Sandbox (teste)</option>
                <option value="live">Live (produção)</option>
              </select>
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell nav={ADMIN_NAV} title="Definições & API" email={user.email}>
      {savedMsg && (
        <div className="mb-4 rounded-xl border border-teal/25 bg-teal/10 px-4 py-2.5 text-sm text-teal">{savedMsg}</div>
      )}

      {/* Assistant / API */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold">Assistente (IA)</h2>
        <div className="card grid max-w-2xl gap-3 p-5">
          <p className="text-sm text-muted">
            Liga um provedor de IA para o assistente responder a dúvidas de bots e automação. Sem chave, o assistente responde com respostas guiadas.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={!!assistant.enabled} onChange={(e) => setAssistant({ ...assistant, enabled: e.target.checked })} />
            Assistente ativo
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Provedor</span>
            <select className="field" value={assistant.provider || 'anthropic'} onChange={(e) => setAssistant({ ...assistant, provider: e.target.value as any })}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </label>
          <Field label="Modelo" value={assistant.model || ''} onChange={(v) => setAssistant({ ...assistant, model: v })} placeholder={assistant.provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001'} />
          <Field label="API key" value={assistant.apiKey || ''} onChange={(v) => setAssistant({ ...assistant, apiKey: v })} placeholder="sk-..." secret />
          <div>
            <button onClick={saveAssistant} disabled={busy === 'ai'} className="btn-primary">{busy === 'ai' ? 'A guardar…' : 'Guardar assistente'}</button>
          </div>
        </div>
      </section>

      {/* Payment gateways */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Gateways de pagamento</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {cardMode('visa', { keys: true, icon: 'fa-brands fa-cc-visa', label: 'Cartão (Visa/Mastercard)' })}
          {cardMode('paypal', { oauth: true, icon: 'fa-brands fa-paypal', label: 'PayPal' })}
          {cardMode('mpesa', { number: true, icon: 'fa-solid fa-mobile-screen', label: 'M-Pesa' })}
          {cardMode('emola', { number: true, icon: 'fa-solid fa-mobile-screen-button', label: 'e-Mola' })}
        </div>
        <div className="mt-4">
          <button onClick={saveGateways} disabled={busy === 'gw'} className="btn-primary">{busy === 'gw' ? 'A guardar…' : 'Guardar gateways'}</button>
        </div>
      </section>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input
        type={secret ? 'password' : 'text'}
        className="field"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
