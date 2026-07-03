'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { mzn, dateTime } from '@/lib/format';

interface TenantRow {
  id: string;
  name: string;
  status: string;
  plan: string | null;
  users: number;
  transactions: number;
  revenue: number;
  createdAt: string;
}

const STATUS_CHIP: Record<string, string> = {
  active: 'bg-teal/10 text-teal border border-teal/25',
  trial: 'bg-gold/10 text-gold border border-gold/25',
  past_due: 'bg-danger/10 text-danger border border-danger/25',
  suspended: 'bg-danger/10 text-danger border border-danger/25',
  cancelled: 'bg-hover text-muted border border-line',
};

export default function AdminTenantsPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [rows, setRows] = useState<TenantRow[]>([]);

  async function load() {
    const res = await authApi.get('/admin/tenants');
    setRows(res.data);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function suspend(id: string, status: string) {
    const action = status === 'suspended' ? 'reactivate' : 'suspend';
    await authApi.post(`/admin/tenants/${id}/${action}`);
    load();
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Tenants" email={user?.email} badge="Super Admin">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Utilizadores</th>
                <th className="px-4 py-3 font-medium">Transações</th>
                <th className="px-4 py-3 font-medium">Receita</th>
                <th className="px-4 py-3 font-medium">Criado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">A carregar…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Sem tenants.</td></tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted">{t.plan ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${STATUS_CHIP[t.status] ?? STATUS_CHIP.cancelled}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3">{t.users}</td>
                    <td className="px-4 py-3">{t.transactions}</td>
                    <td className="px-4 py-3 font-semibold text-teal">{mzn(t.revenue)}</td>
                    <td className="px-4 py-3 text-muted">{dateTime(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => suspend(t.id, t.status)} className="btn-ghost !px-3 !py-1.5 text-xs">
                        {t.status === 'suspended' ? 'Reativar' : 'Suspender'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
