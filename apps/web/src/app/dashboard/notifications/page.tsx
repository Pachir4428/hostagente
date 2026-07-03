'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

const TYPE_DOT: Record<string, string> = {
  info: 'bg-teal',
  warning: 'bg-gold',
  error: 'bg-danger',
};

export default function NotificationsPage() {
  const { user, loading } = useAuth('TENANT');
  const [items, setItems] = useState<Notif[]>([]);
  const [ann, setAnn] = useState<Announcement[]>([]);

  async function load() {
    const [n, a] = await Promise.all([
      authApi.get('/notifications'),
      authApi.get('/announcements').catch(() => ({ data: [] })),
    ]);
    setItems(n.data);
    setAnn(a.data);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function markAll() {
    await authApi.post('/notifications/read-all');
    load();
  }

  async function markOne(id: string) {
    await authApi.post(`/notifications/${id}/read`);
    load();
  }

  return (
    <AppShell nav={TENANT_NAV} title="Notificações" email={user?.email}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : (
        <div className="space-y-6">
          {ann.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-lg font-semibold">Comunicados</h2>
              <div className="space-y-3">
                {ann.map((a) => (
                  <div key={a.id} className="card border-teal/30 p-5">
                    <div className="flex items-center gap-2">
                      <span>📣</span>
                      <p className="font-display font-semibold">{a.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted">{a.body}</p>
                    <p className="mt-2 text-xs text-muted2">{dateTime(a.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Alertas</h2>
              {items.some((i) => !i.read) && (
                <button onClick={markAll} className="btn-ghost !px-3 !py-1.5 text-sm">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <div className="card py-12 text-center text-muted">Sem notificações.</div>
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`card flex items-start gap-3 p-4 ${n.read ? 'opacity-60' : ''}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type] ?? 'bg-muted2'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{n.title}</p>
                      <p className="text-sm text-muted">{n.message}</p>
                      <p className="mt-1 text-xs text-muted2">{dateTime(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <button onClick={() => markOne(n.id)} className="text-xs text-teal hover:underline">
                        Marcar lida
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
