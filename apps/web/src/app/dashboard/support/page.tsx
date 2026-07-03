'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  _count?: { messages: number };
}
interface Message {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export default function SupportPage() {
  const { user, loading } = useAuth('TENANT');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [reply, setReply] = useState('');

  async function load() {
    const res = await authApi.get('/support');
    setTickets(res.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function open(id: string) {
    const res = await authApi.get(`/support/${id}`);
    setActive(res.data);
  }
  async function create() {
    await authApi.post('/support', form);
    setShowNew(false);
    setForm({ subject: '', body: '' });
    load();
  }
  async function send() {
    if (!reply.trim()) return;
    const res = await authApi.post(`/support/${active.id}/messages`, { body: reply });
    setReply('');
    setActive(res.data);
  }

  return (
    <AppShell nav={TENANT_NAV} title="Suporte" email={user?.email}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted">Abre um ticket e a nossa equipa responde aqui.</p>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ Novo ticket</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
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
                <p className="mt-1 text-xs text-muted">{dateTime(t.updatedAt)}</p>
              </button>
            ))}
          </div>

          <div>
            {active ? (
              <div className="card flex h-full flex-col p-5">
                <h2 className="font-display text-lg font-semibold">{active.subject}</h2>
                <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                  {active.messages.map((m: Message) => {
                    const mine = m.authorRole !== 'SUPER_ADMIN';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-teal/15 text-ink' : 'bg-hover text-ink'}`}>
                          <p className="mb-1 text-[10px] uppercase text-muted2">{mine ? 'Tu' : 'Suporte'}</p>
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {active.status === 'open' && (
                  <div className="mt-4 flex gap-2">
                    <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} className="field" placeholder="Escreve uma resposta…" />
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

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Novo ticket</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">Assunto</label>
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Mensagem</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="field min-h-[100px]" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="btn-ghost">Cancelar</button>
              <button onClick={create} disabled={!form.subject || !form.body} className="btn-primary">Criar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
