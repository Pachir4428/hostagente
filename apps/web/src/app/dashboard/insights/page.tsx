'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { mzn } from '@/lib/format';

interface Insights {
  totalSales: number;
  revenue: number;
  avgTicket: number;
  uniqueCustomers: number;
  recurringCustomers: number;
  topPackages: { name: string; count: number; revenue: number }[];
  byHour: number[];
  byDay: number[];
  topCustomers: { phone: string; count: number; revenue: number }[];
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function InsightsPage() {
  const { user, loading } = useAuth('TENANT');
  const [d, setD] = useState<Insights | null>(null);

  useEffect(() => {
    if (user) authApi.get('/dashboard/insights').then((r) => setD(r.data)).catch(() => {});
  }, [user]);

  const maxHour = Math.max(1, ...(d?.byHour ?? [1]));
  const maxDay = Math.max(1, ...(d?.byDay ?? [1]));
  const maxPkg = Math.max(1, ...(d?.topPackages.map((p) => p.count) ?? [1]));
  const peakHour = d ? d.byHour.indexOf(Math.max(...d.byHour)) : 0;
  const peakDay = d ? d.byDay.indexOf(Math.max(...d.byDay)) : 0;

  return (
    <AppShell nav={TENANT_NAV} title="Insights de vendas" email={user?.email}>
      {loading || !d ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : d.totalSales === 0 ? (
        <div className="card p-10 text-center">
          <i className="fa-solid fa-chart-pie text-3xl text-muted2" />
          <p className="mt-3 text-muted">Ainda sem vendas suficientes para insights. Volta quando tiveres vendas registadas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Vendas (90 dias)" value={String(d.totalSales)} icon="fa-receipt" />
            <Kpi label="Receita" value={mzn(d.revenue)} icon="fa-sack-dollar" />
            <Kpi label="Ticket médio" value={mzn(d.avgTicket)} icon="fa-tag" />
            <Kpi label="Clientes recorrentes" value={`${d.recurringCustomers}/${d.uniqueCustomers}`} icon="fa-repeat" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top packages */}
            <div className="card p-6">
              <h2 className="mb-4 font-display text-lg font-bold">Pacotes mais vendidos</h2>
              <div className="space-y-3">
                {d.topPackages.map((p) => (
                  <div key={p.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="ml-2 shrink-0 text-muted">{p.count}× · {mzn(p.revenue)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-hover">
                      <div className="h-full rounded-full bg-teal" style={{ width: `${(p.count / maxPkg) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top customers */}
            <div className="card p-6">
              <h2 className="mb-4 font-display text-lg font-bold">Melhores clientes</h2>
              <div className="space-y-2">
                {d.topCustomers.map((c, i) => (
                  <div key={c.phone} className="flex items-center justify-between border-b border-line/60 py-2 text-sm last:border-0">
                    <span className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-hover text-xs text-muted">{i + 1}</span>
                      <span className="font-mono">{c.phone}</span>
                    </span>
                    <span className="text-muted">{c.count}× · <span className="font-semibold text-ink">{mzn(c.revenue)}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peak hours */}
          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Horas de pico</h2>
              <span className="text-sm text-muted">Mais forte às <b className="text-teal">{String(peakHour).padStart(2, '0')}h</b></span>
            </div>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {d.byHour.map((v, h) => (
                <div key={h} className="group flex flex-1 flex-col items-center justify-end" title={`${h}h: ${v}`}>
                  <div className={`w-full rounded-t ${h === peakHour ? 'bg-teal' : 'bg-teal/30'}`} style={{ height: `${(v / maxHour) * 100}%`, minHeight: v ? 3 : 0 }} />
                  {h % 3 === 0 && <span className="mt-1 text-[9px] text-muted2">{h}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Peak days */}
          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Dias mais fortes</h2>
              <span className="text-sm text-muted">Melhor dia: <b className="text-teal">{DAYS[peakDay]}</b></span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {d.byDay.map((v, i) => (
                <div key={i} className="text-center">
                  <div className="flex h-24 items-end justify-center">
                    <div className={`w-6 rounded-t ${i === peakDay ? 'bg-teal' : 'bg-teal/30'}`} style={{ height: `${(v / maxDay) * 100}%`, minHeight: v ? 4 : 0 }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">{DAYS[i]}</p>
                  <p className="text-[10px] text-muted2">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <i className={`fa-solid ${icon} text-teal`} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
