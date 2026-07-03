'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { mzn } from '@/lib/format';

interface PlatformSummary {
  mrr: number;
  tenants: { total: number; active: number; trial: number; past_due: number; suspended: number; cancelled: number };
  newTenants: { last7: number; last30: number };
  churnRate: number;
  totalTransactions: number;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [data, setData] = useState<PlatformSummary | null>(null);

  useEffect(() => {
    if (user) authApi.get('/admin/platform/summary').then((r) => setData(r.data)).catch(() => {});
  }, [user]);

  return (
    <AppShell nav={ADMIN_NAV} title="Plataforma" email={user?.email} badge="Super Admin">
      {loading || !data ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <p className="text-sm text-muted">MRR</p>
              <p className="mt-2 font-display text-3xl font-bold text-teal">{mzn(data.mrr)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-muted">Tenants ativos</p>
              <p className="mt-2 font-display text-3xl font-bold">{data.tenants.active}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-muted">Novos (30 dias)</p>
              <p className="mt-2 font-display text-3xl font-bold">{data.newTenants.last30}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-muted">Taxa de churn</p>
              <p className="mt-2 font-display text-3xl font-bold">{(data.churnRate * 100).toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { l: 'Total', v: data.tenants.total },
              { l: 'Trial', v: data.tenants.trial },
              { l: 'Ativos', v: data.tenants.active },
              { l: 'Em atraso', v: data.tenants.past_due },
              { l: 'Suspensos', v: data.tenants.suspended },
              { l: 'Cancelados', v: data.tenants.cancelled },
            ].map((s) => (
              <div key={s.l} className="card p-4">
                <p className="text-xs text-muted">{s.l}</p>
                <p className="mt-1 font-display text-xl font-bold">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <p className="text-sm text-muted">Transações processadas (todos os tenants)</p>
            <p className="mt-2 font-display text-2xl font-bold">{data.totalTransactions}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
