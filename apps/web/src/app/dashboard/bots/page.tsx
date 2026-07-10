'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Bot {
  id: string;
  name: string;
  type: 'auto' | 'manual';
  status: string;
  phoneNumber?: string | null;
  createdAt: string;
}

const STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  connected: { label: 'Ligado', chip: 'bg-teal/10 text-teal border border-teal/25', dot: 'bg-teal' },
  waiting_qr: { label: 'A aguardar QR', chip: 'bg-gold/10 text-gold border border-gold/25', dot: 'bg-gold' },
  starting: { label: 'A iniciar', chip: 'bg-gold/10 text-gold border border-gold/25', dot: 'bg-gold' },
  stopped: { label: 'Parado', chip: 'bg-hover text-muted border border-line', dot: 'bg-muted2' },
  error: { label: 'Erro', chip: 'bg-danger/10 text-danger border border-danger/25', dot: 'bg-danger' },
};

function st(s: string) {
  return STATUS[s] || STATUS.stopped;
}

export default function BotsPage() {
  const { user, loading } = useAuth('TENANT');
  const [bots, setBots] = useState<Bot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'manual', phoneNumber: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await authApi.get('/bots');
    setBots(res.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function create() {
    setSaving(true);
    try {
      await authApi.post('/bots', {
        name: form.name.trim(),
        type: form.type,
        phoneNumber: form.phoneNumber || undefined,
      });
      setShowModal(false);
      setForm({ name: '', type: 'manual', phoneNumber: '' });
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível criar o bot');
    } finally {
      setSaving(false);
    }
  }

  async function downloadTemplate() {
    try {
      const res = await authApi.get('/bots/template/download', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bot-modelo-hostagente.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Não foi possível descarregar o modelo.');
    }
  }

  return (
    <AppShell nav={TENANT_NAV} title="Bots" email={user?.email}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted">
          Bots manuais (Baileys) correm na plataforma e ligam ao WhatsApp por QR ou código.
        </p>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-ghost" title="Descarregar um bot Baileys pronto que já reporta grupos">
            <i className="fa-solid fa-download" /> Bot-modelo
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <i className="fa-solid fa-plus" /> Novo bot
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : bots.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/10 text-2xl">
            <i className="fa-solid fa-robot text-teal" />
          </div>
          <p className="mt-4 font-display text-lg font-semibold">Ainda não tens bots</p>
          <p className="mt-1 text-sm text-muted">Cria o teu primeiro bot de WhatsApp.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-6"><i className="fa-solid fa-plus" /> Criar bot</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((b) => {
            const s = st(b.status);
            return (
              <Link key={b.id} href={`/dashboard/bots/${b.id}`}>
                <div className="card group h-full p-5 transition hover:border-teal/30 hover:shadow-glow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 text-teal">
                        <i className="fa-solid fa-robot" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold">{b.name}</h3>
                        <p className="text-xs text-muted">{b.type === 'manual' ? 'Manual (Baileys)' : 'Automático'}</p>
                      </div>
                    </div>
                    <span className={`chip ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-muted">
                    <span>{dateTime(b.createdAt)}</span>
                    <span className="text-teal opacity-0 transition group-hover:opacity-100">Abrir consola →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Novo bot</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">Nome</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" placeholder="Ex: Atendimento" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="field">
                  <option value="manual">Manual (Baileys, corre na plataforma)</option>
                  <option value="auto">Automático (MacroDroid)</option>
                </select>
              </div>
              {form.type === 'manual' && (
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Número (opcional, para código de emparelhamento)</label>
                  <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="field" placeholder="2588xxxxxxx" />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={create} disabled={saving || !form.name.trim()} className="btn-primary">{saving ? 'A criar…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
