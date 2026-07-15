'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function AccountPage() {
  const { user, loading } = useAuth('TENANT');
  const [account, setAccount] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', contact: '', receivingNumber: '' });
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const [twoFABusy, setTwoFABusy] = useState(false);

  async function toggle2FA() {
    setTwoFABusy(true);
    try {
      const res = await authApi.post('/auth/2fa/toggle', { enabled: !twoFA });
      setTwoFA(res.data.twoFactorEnabled);
    } catch {
      alert('Não foi possível alterar. (Precisa de SMTP configurado para enviar o código.)');
    } finally {
      setTwoFABusy(false);
    }
  }

  async function load() {
    const [a, k, me] = await Promise.all([authApi.get('/account'), authApi.get('/account/api-keys'), authApi.get('/auth/me')]);
    setAccount(a.data);
    setKeys(k.data);
    setTwoFA(!!me.data?.twoFactorEnabled);
    setForm({
      name: a.data?.name ?? '',
      contact: a.data?.contact ?? '',
      receivingNumber: a.data?.receivingNumber ?? '',
    });
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function saveAccount() {
    setSaving(true);
    try {
      await authApi.patch('/account', form);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!confirm('Regenerar a chave? A chave antiga deixa de funcionar imediatamente.')) return;
    await authApi.post('/account/api-keys/regenerate');
    setRevealed(true);
    load();
  }

  const apiKey = keys[0]?.key as string | undefined;

  return (
    <AppShell nav={TENANT_NAV} title="Conta & API" email={user?.email}>
      {loading || !account ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Business data */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold">Dados do negócio</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">Nome do negócio</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Contacto</label>
                <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="field" placeholder="84 000 0000" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Número de recebimento</label>
                <input value={form.receivingNumber} onChange={(e) => setForm({ ...form, receivingNumber: e.target.value })} className="field" placeholder="Número M-Pesa/e-Mola" />
              </div>
              <button onClick={saveAccount} disabled={saving} className="btn-primary">
                {saving ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* API key */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold">Chave de API (MacroDroid)</h2>
            <p className="mt-1 text-sm text-muted">Usa esta chave no MacroDroid para enviar os pagamentos detetados.</p>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl border border-line bg-surface2 px-3 py-2.5 font-mono text-sm">
                {apiKey ? (revealed ? apiKey : apiKey.slice(0, 10) + '••••••••••••') : '—'}
              </code>
              <button onClick={() => setRevealed((v) => !v)} className="btn-ghost !px-3 !py-2.5">
                {revealed ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            <button onClick={regenerate} className="btn-ghost mt-3 text-sm">Regenerar chave</button>

            <div className="mt-6 rounded-xl border border-line bg-surface2 p-4 text-sm">
              <p className="font-display font-semibold">Configuração no MacroDroid</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                <li>Cria um gatilho: SMS recebido de M-Pesa / e-Mola.</li>
                <li>Ação: HTTP Request (POST) para:</li>
              </ol>
              <code className="mt-2 block break-all rounded-lg bg-bg px-3 py-2 font-mono text-xs text-teal">
                {API_URL}/ingest/macrodroid
              </code>
              <p className="mt-2 text-muted">Header <span className="font-mono text-ink">x-api-key</span> com a tua chave, e body JSON:</p>
              <code className="mt-1 block whitespace-pre rounded-lg bg-bg px-3 py-2 font-mono text-xs text-muted">
{`{
  "phone": "{sms_number}",
  "amount": 50,
  "operator": "mpesa",
  "reference": "{ref}",
  "raw": "{sms_message}"
}`}
              </code>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card mt-6 max-w-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold"><i className="fa-solid fa-shield-halved mr-2 text-teal" />Verificação em duas etapas (2FA)</h2>
              <p className="mt-1 text-sm text-muted">Ao entrar, pedimos um código de 6 dígitos enviado para o teu email. Mais segurança para a tua conta.</p>
            </div>
            <button
              onClick={toggle2FA}
              disabled={twoFABusy}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${twoFA ? 'bg-teal' : 'bg-line'}`}
              aria-label="Alternar 2FA"
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${twoFA ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {twoFA && <p className="mt-3 text-xs text-teal"><i className="fa-solid fa-check mr-1" />Ativa. Precisa de SMTP configurado pelo administrador para enviar os códigos.</p>}
        </div>
      )}
    </AppShell>
  );
}
