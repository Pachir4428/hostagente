'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { mzn, dateTime } from '@/lib/format';

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  maxTransactions: number;
  maxUsers: number;
  features: string[];
}

interface Current {
  plan: Plan | null;
  status: string;
  currentPeriodEnd: string | null;
  usage: { transactions: number; maxTransactions: number | null };
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS_CHIP: Record<string, string> = {
  active: 'bg-teal/10 text-teal border border-teal/25',
  trial: 'bg-gold/10 text-gold border border-gold/25',
  past_due: 'bg-danger/10 text-danger border border-danger/25',
  cancelled: 'bg-hover text-muted border border-line',
  paid: 'bg-teal/10 text-teal border border-teal/25',
  pending: 'bg-gold/10 text-gold border border-gold/25',
  failed: 'bg-danger/10 text-danger border border-danger/25',
};

export default function SubscriptionPage() {
  const { user, loading } = useAuth('TENANT');
  const [current, setCurrent] = useState<Current | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const [c, p, i] = await Promise.all([
      authApi.get('/subscription'),
      authApi.get('/subscription/plans'),
      authApi.get('/subscription/invoices'),
    ]);
    setCurrent(c.data);
    setPlans(p.data);
    setInvoices(i.data);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function changePlan(planId: string) {
    setBusy(planId);
    try {
      await authApi.post('/subscription/change', { planId });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível mudar de plano');
    } finally {
      setBusy('');
    }
  }

  const usagePct =
    current?.usage.maxTransactions && current.usage.maxTransactions > 0
      ? Math.min(100, (current.usage.transactions / current.usage.maxTransactions) * 100)
      : 0;

  return (
    <AppShell nav={TENANT_NAV} title="Assinatura" email={user?.email}>
      {loading || !current ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current plan */}
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Plano atual</p>
                <p className="font-display text-2xl font-bold">{current.plan?.name ?? '—'}</p>
              </div>
              <span className={`chip ${STATUS_CHIP[current.status] ?? STATUS_CHIP.cancelled}`}>
                {current.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted">Transações este mês</p>
                <p className="mt-1 font-display text-xl font-bold">
                  {current.usage.transactions}
                  {current.usage.maxTransactions ? ` / ${current.usage.maxTransactions}` : ''}
                </p>
                {current.usage.maxTransactions ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hover">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${usagePct}%` }} />
                  </div>
                ) : null}
              </div>
              <div>
                <p className="text-sm text-muted">Próxima cobrança</p>
                <p className="mt-1 font-display text-xl font-bold">
                  {current.currentPeriodEnd ? dateTime(current.currentPeriodEnd) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Plans */}
          <div>
            <h2 className="mb-4 font-display text-lg font-semibold">Planos disponíveis</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((p) => {
                const isCurrent = current.plan?.id === p.id;
                return (
                  <div key={p.id} className={`card p-6 ${isCurrent ? 'border-teal/40 shadow-glow' : ''}`}>
                    <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold">{p.priceMonthly}</span>
                      <span className="text-muted">MZN/mês</span>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-muted">
                      <li className="flex items-center gap-2"><span className="text-teal">✓</span> {p.maxTransactions} transações/mês</li>
                      <li className="flex items-center gap-2"><span className="text-teal">✓</span> {p.maxUsers} utilizador(es)</li>
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2"><span className="text-teal">✓</span> {f}</li>
                      ))}
                    </ul>
                    <button
                      disabled={isCurrent || busy === p.id}
                      onClick={() => changePlan(p.id)}
                      className={`mt-6 w-full ${isCurrent ? 'btn-ghost' : 'btn-primary'}`}
                    >
                      {isCurrent ? 'Plano atual' : busy === p.id ? 'A mudar…' : 'Escolher'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invoices */}
          <div>
            <h2 className="mb-4 font-display text-lg font-semibold">Histórico de faturas</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">Sem faturas.</td></tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3 text-muted">{dateTime(inv.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold">{mzn(inv.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`chip ${STATUS_CHIP[inv.status] ?? STATUS_CHIP.pending}`}>{inv.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
