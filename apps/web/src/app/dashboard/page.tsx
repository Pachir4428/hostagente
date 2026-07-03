'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { mzn, dateTime, TX_STATUS, OPERATOR_LABEL } from '@/lib/format';

interface Summary {
  salesToday: number;
  revenueToday: number;
  lastTransaction: any;
  series: { date: string; sales: number; revenue: number }[];
  macrodroid: { online: boolean; lastSeen: string | null; minutesSince: number | null };
  plan: string | null;
  subscriptionStatus: string | null;
}

export default function TenantDashboard() {
  const { user, loading } = useAuth('TENANT');
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    authApi
      .get('/dashboard/summary')
      .then((r) => setData(r.data))
      .catch((e) =>
        setErr(
          e.response?.status === 404
            ? 'A API ainda não tem o endpoint /dashboard/summary. Reconstrói e reinicia o container da API.'
            : e.response?.data?.message || 'Não foi possível carregar o resumo.',
        ),
      )
      .finally(() => setLoadingData(false));
  }, [user]);

  const maxRevenue = Math.max(1, ...(data?.series.map((d) => d.revenue) ?? [1]));

  return (
    <AppShell
      nav={TENANT_NAV}
      title="Resumo"
      email={user?.email}
      badge={data?.plan ? `◈ Plano ${data.plan}` : undefined}
    >
      {loading || loadingData ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : err || !data ? (
        <div className="card border-danger/30 p-6 text-center">
          <p className="font-display font-semibold text-danger">Não foi possível carregar o resumo</p>
          <p className="mt-2 text-sm text-muted">{err ?? 'Sem dados.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* MacroDroid status */}
          <div
            className={`card flex items-center gap-3 px-5 py-4 ${
              data.macrodroid.online ? '' : 'border-danger/30'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${data.macrodroid.online ? 'bg-teal' : 'bg-danger'}`}
            />
            <div>
              <p className="font-display font-semibold">
                MacroDroid {data.macrodroid.online ? 'online' : 'sem sinal'}
              </p>
              <p className="text-sm text-muted">
                {data.macrodroid.lastSeen
                  ? `Última atividade há ${data.macrodroid.minutesSince} min`
                  : 'Ainda sem transações recebidas'}
              </p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-muted">Vendas de hoje</p>
              <p className="mt-2 font-display text-3xl font-bold">{data.salesToday}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-muted">Receita de hoje</p>
              <p className="mt-2 font-display text-3xl font-bold text-teal">{mzn(data.revenueToday)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-muted">Última venda</p>
              {data.lastTransaction ? (
                <>
                  <p className="mt-2 font-display text-xl font-bold">
                    {mzn(data.lastTransaction.amount)}
                  </p>
                  <p className="text-xs text-muted">
                    {data.lastTransaction.phoneNumber} · {dateTime(data.lastTransaction.createdAt)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-muted">—</p>
              )}
            </div>
          </div>

          {/* 7-day chart */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold">Vendas dos últimos 7 dias</h2>
            <div className="mt-6 flex items-end gap-3" style={{ height: 180 }}>
              {data.series.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-teal/70 transition-all"
                      style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue ? 4 : 0 }}
                      title={`${mzn(d.revenue)} · ${d.sales} vendas`}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent last transaction detail */}
          {data.lastTransaction && (
            <div className="card p-5">
              <h2 className="font-display text-lg font-semibold">Última transação</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className={`chip ${TX_STATUS[data.lastTransaction.status]?.chip}`}>
                  {TX_STATUS[data.lastTransaction.status]?.label ?? data.lastTransaction.status}
                </span>
                <span className="text-muted">{OPERATOR_LABEL[data.lastTransaction.operator]}</span>
                <span className="font-mono text-muted">{data.lastTransaction.phoneNumber}</span>
                <span className="font-semibold">{mzn(data.lastTransaction.amount)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
