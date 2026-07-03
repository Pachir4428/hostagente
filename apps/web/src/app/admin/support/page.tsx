'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  tenant?: { name: string };
}
interface Message {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export default function AdminSupportPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('');

  async function load() {
    const res = await authApi.get('/admin/support', { params: filter ? { status: filter } : {} });
    setTickets(res.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter]);

  async function open(id: string) {
    const res = await authApi.get(`/admin/support/${id}`);
    setActive(res.data);
  }
  async function send() {
    if (!reply.trim()) return;
    const res = await authApi.post(`/admin/support/${active.id}/messages`, { body: reply });
    setReply('');
    setActive(res.data);
  }
  async function resolve() {
    await authApi.post(`/admin/support/${active.id}/resolve`);
    await open(active.id);
    load();
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Suporte" email={user?.email} badge="Super Admin">
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div>
            <div className="mb-3 flex gap-2">
              {['', 'open', 'resolved'].map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`chip border ${filter === s ? 'border-teal/40 text-teal' : 'border-line text-muted'}`}>
                  {s === '' ? 'Todos' : s === 'open' ? 'Abertos' : 'Resolvidos'}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {tickets.length === 0 ? (
                <div className="card py-10 text-center text-muted">Sem tickets.</div>
              ) : tickets.map((t) => (
                <button key={t.id} onClick={() => open(t.id)} className={`card w-full p-4 text-left transition hover:border-teal/30 ${active?.id === t.id ? 'border-teal/40' : ''}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.subject}</p>
                    <span className={`chip ${t.status === 'open' ? 'bg-gold/10 text-gold border border-gold/25' : 'bg-teal/10 text-teal border border-teal/25'}`}>
                      {t.status === 'open' ? 'Aberto' : 'Resolvido'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t.tenant?.name} · {dateTime(t.updatedAt)}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            {active ? (
              <div className="card flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">{active.subject}</h2>
                  {active.status === 'open' && (
                    <button onClick={resolve} className="btn-ghost !px-3 !py-1.5 text-sm">Marcar resolvido</button>
                  )}
                </div>
                <p className="text-sm text-muted">{active.tenant?.name}</p>
                <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                  {active.messages.map((m: Message) => {
                    const mine = m.authorRole === 'SUPER_ADMIN';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-teal/15' : 'bg-hover'}`}>
                          <p className="mb-1 text-[10px] uppercase text-muted2">{mine ? 'Suporte' : 'Cliente'}</p>
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {active.status === 'open' && (
                  <div className="mt-4 flex gap-2">
                    <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} className="field" placeholder="Responder…" />
                    <button onClick={send} className="btn-primary">Enviar</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="card flex h-full items-center justify-center py-20 text-muted">Seleciona um ticket.</div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
