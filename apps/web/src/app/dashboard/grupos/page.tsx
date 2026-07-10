'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';

interface Sub {
  botId: string;
  botName: string;
  id: string;
  name: string;
  plan: string | null;
  validUntil: string | null;
  state: 'active' | 'expiring' | 'expired' | 'none';
  daysLeft: number | null;
}

const STATE: Record<string, { label: string; chip: string }> = {
  active: { label: 'Ativa', chip: 'bg-teal/10 text-teal border border-teal/25' },
  expiring: { label: 'A expirar', chip: 'bg-gold/10 text-gold border border-gold/25' },
  expired: { label: 'Expirada', chip: 'bg-danger/10 text-danger border border-danger/25' },
  none: { label: 'Sem validade', chip: 'bg-hover text-muted border border-line' },
};

export default function GruposPage() {
  const { user, loading } = useAuth('TENANT');
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

  async function load() {
    const res = await authApi.get('/bots/subscriptions/groups');
    setSubs(res.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function renew(s: Sub, months: number) {
    setBusy(s.botId + s.id);
    try {
      await authApi.post(`/bots/${s.botId}/groups/${encodeURIComponent(s.id)}/renew`, { months });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível renovar');
    } finally {
      setBusy('');
    }
  }

  const filtered = subs.filter((s) => {
    if (filter !== 'all' && s.state !== filter) return false;
    if (q && !`${s.name} ${s.botName} ${s.plan || ''} ${s.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const counts = {
    active: subs.filter((s) => s.state === 'active').length,
    expiring: subs.filter((s) => s.state === 'expiring').length,
    expired: subs.filter((s) => s.state === 'expired').length,
  };

  return (
    <AppShell nav={TENANT_NAV} title="Grupos & Assinaturas" email={user?.email}>
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Ativas" value={counts.active} icon="fa-circle-check" tone="text-teal" />
            <Stat label="A expirar (7 dias)" value={counts.expiring} icon="fa-triangle-exclamation" tone="text-gold" />
            <Stat label="Expiradas" value={counts.expired} icon="fa-circle-xmark" tone="text-danger" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-line">
              {(['all', 'active', 'expiring', 'expired'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs transition ${filter === f ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-hover'}`}>
                  {f === 'all' ? 'Todas' : STATE[f].label}
                </button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar grupo, bot, plano…" className="field max-w-xs text-sm" />
          </div>

          {/* Table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">Bot</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Validade</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Renovar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Sem assinaturas de grupos. Adiciona grupos na página de um bot.</td></tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.botId + s.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="font-mono text-[10px] text-muted2">{s.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/bots/${s.botId}`} className="text-teal hover:underline">{s.botName}</Link>
                      </td>
                      <td className="px-4 py-3">{s.plan || '—'}</td>
                      <td className="px-4 py-3 text-muted">
                        {s.validUntil ? new Date(s.validUntil).toLocaleDateString('pt-PT') : '—'}
                        {s.daysLeft !== null && s.state !== 'expired' && <span className="ml-1 text-xs text-muted2">({s.daysLeft}d)</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`chip ${STATE[s.state].chip}`}>{STATE[s.state].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => renew(s, 1)} disabled={!!busy} className="btn-ghost !px-2.5 !py-1 text-xs">+1 mês</button>
                          <button onClick={() => renew(s, 3)} disabled={!!busy} className="btn-primary !px-2.5 !py-1 text-xs">+3 meses</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: string; tone: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`grid h-11 w-11 place-items-center rounded-xl bg-hover ${tone}`}><i className={`fa-solid ${icon}`} /></span>
      <div>
        <p className="font-display text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
