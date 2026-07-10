'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { mzn } from '@/lib/format';

interface Summary {
  mrr: number;
  revenueTotal: number;
  revenueMonth: number;
  pendingAmount: number;
  pendingCount: number;
  activeSubscriptions: number;
  byPlan: { name: string; count: number; mrr: number }[];
  topTenants: { tenant: string; total: number }[];
}

export default function AdminRevenuePage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [d, setD] = useState<Summary | null>(null);

  useEffect(() => {
    if (user) authApi.get('/admin/revenue/summary').then((r) => setD(r.data)).catch(() => {});
  }, [user]);

  const maxPlanMrr = Math.max(1, ...(d?.byPlan.map((p) => p.mrr) ?? [1]));

  return (
    <AppShell nav={ADMIN_NAV} title="Receita" email={user?.email} badge="Super Admin">
      {loading || !d ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="MRR (receita recorrente)" value={mzn(d.mrr)} icon="fa-arrows-rotate" tone="text-teal" />
            <Kpi label="Receita este mês" value={mzn(d.revenueMonth)} icon="fa-calendar-day" tone="text-teal" />
            <Kpi label="Receita total" value={mzn(d.revenueTotal)} icon="fa-sack-dollar" tone="text-ink" />
            <Kpi label={`Pendente (${d.pendingCount})`} value={mzn(d.pendingAmount)} icon="fa-hourglass-half" tone="text-gold" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* By plan */}
            <div className="card p-6">
              <h2 className="mb-1 font-display text-lg font-bold">Receita por plano</h2>
              <p className="mb-4 text-sm text-muted">{d.activeSubscriptions} assinatura(s) ativa(s)</p>
              <div className="space-y-3">
                {d.byPlan.length === 0 ? (
                  <p className="text-sm text-muted">Sem assinaturas ativas.</p>
                ) : (
                  d.byPlan.map((p) => (
                    <div key={p.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">{p.name} <span className="text-muted">· {p.count}</span></span>
                        <span className="font-display font-semibold">{mzn(p.mrr)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-hover">
                        <div className="h-full rounded-full bg-teal" style={{ width: `${(p.mrr / maxPlanMrr) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top tenants */}
            <div className="card p-6">
              <h2 className="mb-4 font-display text-lg font-bold">Top revendedores (pago)</h2>
              <div className="space-y-2">
                {d.topTenants.length === 0 ? (
                  <p className="text-sm text-muted">Sem pagamentos ainda.</p>
                ) : (
                  d.topTenants.map((t, i) => (
                    <div key={t.tenant} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
                      <span className="flex items-center gap-3 text-sm">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-hover text-xs text-muted">{i + 1}</span>
                        {t.tenant}
                      </span>
                      <span className="font-display font-semibold">{mzn(t.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <i className={`fa-solid ${icon} ${tone}`} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
