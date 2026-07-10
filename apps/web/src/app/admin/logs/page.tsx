'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Log {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  meta: any;
  createdAt: string;
}

export default function AdminLogsPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (user) authApi.get('/admin/logs').then((r) => setLogs(r.data)).catch(() => {});
  }, [user]);

  return (
    <AppShell nav={ADMIN_NAV} title="Logs & Auditoria" email={user?.email} badge="Super Admin">
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Ator</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Sem registos.</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 text-muted">{dateTime(l.createdAt)}</td>
                  <td className="px-4 py-3">{l.actorEmail ?? l.actorRole ?? 'sistema'}</td>
                  <td className="px-4 py-3"><span className="font-mono text-teal">{l.action}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{l.meta ? JSON.stringify(l.meta) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
