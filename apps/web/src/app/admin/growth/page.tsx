'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';

interface Growth {
  total: number;
  trial: number;
  active: number;
  suspended: number;
  cancelled: number;
  conversionPct: number;
  churnPct: number;
  newLast30: number;
  series: { date: string; count: number }[];
}

export default function AdminGrowthPage() {
  const { user } = useAuth('SUPER_ADMIN');
  const [d, setD] = useState<Growth | null>(null);

  useEffect(() => {
    if (user) authApi.get('/admin/platform/growth').then((r) => setD(r.data)).catch(() => {});
  }, [user]);

  const max = Math.max(1, ...(d?.series.map((s) => s.count) ?? [1]));

  return (
    <AppShell nav={ADMIN_NAV} title="Crescimento" email={user?.email} badge="Super Admin">
      {!d ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Novos (30 dias)" value={String(d.newLast30)} icon="fa-user-plus" />
            <Kpi label="Conversão → pago" value={`${d.conversionPct}%`} icon="fa-arrow-trend-up" tone="text-teal" />
            <Kpi label="Churn" value={`${d.churnPct}%`} icon="fa-arrow-trend-down" tone="text-danger" />
            <Kpi label="Em trial" value={String(d.trial)} icon="fa-hourglass-half" tone="text-gold" />
          </div>

          <div className="card p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Novos registos (30 dias)</h2>
            <div className="flex items-end gap-1" style={{ height: 140 }}>
              {d.series.map((s, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center justify-end" title={`${s.date}: ${s.count}`}>
                  <div className="w-full rounded-t bg-teal/40 transition group-hover:bg-teal" style={{ height: `${(s.count / max) * 100}%`, minHeight: s.count ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted2">
              <span>{d.series[0]?.date.slice(5)}</span>
              <span>{d.series[d.series.length - 1]?.date.slice(5)}</span>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="mb-3 font-display font-semibold">Distribuição de tenants</h2>
            <div className="space-y-2 text-sm">
              <Row label="Ativos" value={d.active} total={d.total} tone="bg-teal" />
              <Row label="Trial" value={d.trial} total={d.total} tone="bg-gold" />
              <Row label="Suspensos" value={d.suspended} total={d.total} tone="bg-muted2" />
              <Row label="Cancelados" value={d.cancelled} total={d.total} tone="bg-danger" />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><i className={`fa-solid ${icon} ${tone || 'text-teal'}`} /></div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
function Row({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between"><span>{label}</span><span className="text-muted">{value}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-hover"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
