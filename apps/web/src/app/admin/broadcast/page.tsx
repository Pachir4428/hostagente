'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Broadcast {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function AdminBroadcastPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [items, setItems] = useState<Broadcast[]>([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [sending, setSending] = useState(false);

  async function load() {
    const res = await authApi.get('/admin/broadcast');
    setItems(res.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function send() {
    setSending(true);
    try {
      await authApi.post('/admin/broadcast', form);
      setForm({ title: '', body: '' });
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Comunicados" email={user?.email} badge="Super Admin">
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Enviados</h2>
            {items.length === 0 ? (
              <div className="card py-10 text-center text-muted">Nenhum comunicado enviado.</div>
            ) : items.map((b) => (
              <div key={b.id} className="card p-5">
                <div className="flex items-center gap-2"><span>📣</span><p className="font-display font-semibold">{b.title}</p></div>
                <p className="mt-2 text-sm text-muted">{b.body}</p>
                <p className="mt-2 text-xs text-muted2">{dateTime(b.createdAt)}</p>
              </div>
            ))}
          </div>

          <div className="card h-fit p-6">
            <h2 className="font-display text-lg font-semibold">Novo comunicado</h2>
            <p className="mt-1 text-sm text-muted">Enviado a todos os tenants.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">Título</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Mensagem</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="field min-h-[120px]" />
              </div>
              <button onClick={send} disabled={sending || !form.title || !form.body} className="btn-primary w-full">
                {sending ? 'A enviar…' : 'Enviar a todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
