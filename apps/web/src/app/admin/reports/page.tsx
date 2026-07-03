'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { mzn } from '@/lib/format';

interface Report {
  growth: { month: string; count: number }[];
  totalTenants: number;
  totalRevenueProcessed: number;
  totalTransactions: number;
  mrr: number;
  avgLtv: number;
}

export default function AdminReportsPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [data, setData] = useState<Report | null>(null);

  useEffect(() => {
    if (user) authApi.get('/admin/reports/summary').then((r) => setData(r.data)).catch(() => {});
  }, [user]);

  const maxGrowth = Math.max(1, ...(data?.growth.map((g) => g.count) ?? [1]));

  return (
    <AppShell nav={ADMIN_NAV} title="Relatórios" email={user?.email} badge="Super Admin">
      {loading || !data ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="MRR" value={mzn(data.mrr)} accent />
            <Stat label="LTV médio" value={mzn(data.avgLtv)} />
            <Stat label="Receita processada" value={mzn(data.totalRevenueProcessed)} />
            <Stat label="Transações totais" value={String(data.totalTransactions)} />
          </div>

          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold">Crescimento de contas (6 meses)</h2>
            <div className="mt-6 flex items-end gap-4" style={{ height: 180 }}>
              {data.growth.map((g) => (
                <div key={g.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-lg bg-purple/70" style={{ height: `${(g.count / maxGrowth) * 100}%`, minHeight: g.count ? 4 : 0 }} title={`${g.count} contas`} />
                  </div>
                  <span className="text-[10px] text-muted">{g.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${accent ? 'text-teal' : ''}`}>{value}</p>
    </div>
  );
}
