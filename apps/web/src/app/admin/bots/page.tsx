'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Bot {
  id: string;
  name: string;
  type: string;
  status: string;
  tenant: string;
  updatedAt: string;
}

const CHIP: Record<string, string> = {
  connected: 'bg-teal/10 text-teal border border-teal/25',
  starting: 'bg-gold/10 text-gold border border-gold/25',
  stopped: 'bg-hover text-muted border border-line',
  error: 'bg-danger/10 text-danger border border-danger/25',
};
const LABEL: Record<string, string> = { connected: 'A correr', starting: 'A iniciar', stopped: 'Parado', error: 'Erro' };

export default function AdminBotsPage() {
  const { user } = useAuth('SUPER_ADMIN');
  const [bots, setBots] = useState<Bot[]>([]);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');

  async function load() {
    try { setBots((await authApi.get('/admin/platform/bots')).data); } catch {}
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function act(id: string, action: 'stop' | 'restart') {
    setBusy(id + action);
    try {
      await authApi.post(`/admin/platform/bots/${id}/${action}`);
      setTimeout(load, 1500);
    } finally {
      setBusy('');
    }
  }

  const filtered = bots.filter((b) => !q || `${b.name} ${b.tenant}`.toLowerCase().includes(q.toLowerCase()));
  const active = bots.filter((b) => ['connected', 'starting'].includes(b.status)).length;

  return (
    <AppShell nav={ADMIN_NAV} title="Bots (global)" email={user?.email} badge="Super Admin">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{bots.length} bot(s) · <span className="text-teal">{active} ativos</span></p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar bot ou revendedor…" className="field max-w-xs text-sm" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Bot</th>
              <th className="px-4 py-3 font-medium">Revendedor</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Atualizado</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Sem bots.</td></tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3">{b.tenant}</td>
                  <td className="px-4 py-3 text-muted">{b.type}</td>
                  <td className="px-4 py-3"><span className={`chip ${CHIP[b.status] || CHIP.stopped}`}>{LABEL[b.status] || b.status}</span></td>
                  <td className="px-4 py-3 text-muted">{dateTime(b.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => act(b.id, 'restart')} disabled={!!busy} className="btn-ghost !px-2.5 !py-1 text-xs">{busy === b.id + 'restart' ? '…' : 'Reiniciar'}</button>
                      <button onClick={() => act(b.id, 'stop')} disabled={!!busy} className="btn-ghost !px-2.5 !py-1 text-xs">{busy === b.id + 'stop' ? '…' : 'Parar'}</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
