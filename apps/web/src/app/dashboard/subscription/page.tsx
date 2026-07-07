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

interface Gateway {
  id: 'visa' | 'paypal' | 'mpesa' | 'emola';
  label: string;
  number: string | null;
}
interface Order {
  invoiceId: string;
  reference: string;
  amount: number;
  label: string;
  requiresManual: boolean;
  instructions: string;
}

const GATEWAY_ICON: Record<string, string> = {
  visa: 'fa-brands fa-cc-visa',
  paypal: 'fa-brands fa-paypal',
  mpesa: 'fa-solid fa-mobile-screen',
  emola: 'fa-solid fa-mobile-screen-button',
};

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

  // Checkout state
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

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

  async function openCheckout(plan: Plan) {
    setCheckoutPlan(plan);
    setOrder(null);
    setGateways([]);
    // Free plans activate immediately, no gateway needed.
    if (plan.priceMonthly <= 0) {
      await activateFree(plan.id);
      return;
    }
    try {
      const res = await authApi.get('/checkout/options');
      setGateways(res.data.gateways || []);
    } catch {
      setGateways([]);
    }
  }

  async function activateFree(planId: string) {
    setBusy(planId);
    try {
      await authApi.post('/subscription/change', { planId });
      setCheckoutPlan(null);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível mudar de plano');
    } finally {
      setBusy('');
    }
  }

  async function startPayment(gateway: Gateway['id']) {
    if (!checkoutPlan) return;
    setCheckoutBusy(true);
    try {
      const res = await authApi.post('/checkout', { planId: checkoutPlan.id, gateway });
      setOrder(res.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível iniciar o pagamento');
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function confirmPayment() {
    if (!order) return;
    setCheckoutBusy(true);
    try {
      // Manual gateways (M-Pesa/e-Mola) go to admin review; card/PayPal activate now.
      const endpoint = order.requiresManual ? 'submit' : 'confirm';
      await authApi.post(`/checkout/${order.invoiceId}/${endpoint}`);
      setCheckoutPlan(null);
      setOrder(null);
      await load();
      alert(
        order.requiresManual
          ? 'Pagamento registado! O administrador vai confirmar e o plano será ativado.'
          : 'Pagamento concluído e plano ativado!',
      );
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível confirmar');
    } finally {
      setCheckoutBusy(false);
    }
  }

  function closeCheckout() {
    setCheckoutPlan(null);
    setOrder(null);
    setGateways([]);
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
                      onClick={() => openCheckout(p)}
                      className={`mt-6 w-full ${isCurrent ? 'btn-ghost' : 'btn-primary'}`}
                    >
                      {isCurrent ? 'Plano atual' : busy === p.id ? 'A ativar…' : p.priceMonthly > 0 ? 'Assinar' : 'Escolher'}
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

      {/* Checkout modal */}
      {checkoutPlan && checkoutPlan.priceMonthly > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeCheckout}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Checkout — {checkoutPlan.name}</h2>
              <button onClick={closeCheckout} className="text-muted hover:text-ink"><i className="fa-solid fa-xmark" /></button>
            </div>
            <p className="mt-1 text-sm text-muted">{mzn(checkoutPlan.priceMonthly)} / mês</p>

            {!order ? (
              <div className="mt-5">
                <p className="mb-3 text-sm text-muted">Escolhe o método de pagamento:</p>
                {gateways.length === 0 ? (
                  <p className="rounded-xl border border-line bg-hover px-4 py-3 text-sm text-muted">
                    Nenhum método de pagamento está ativo. Pede ao administrador para configurar em Definições & API.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {gateways.map((g) => (
                      <button
                        key={g.id}
                        disabled={checkoutBusy}
                        onClick={() => startPayment(g.id)}
                        className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-teal/40 hover:bg-hover"
                      >
                        <i className={`${GATEWAY_ICON[g.id]} text-xl text-teal`} />
                        <span className="flex-1 text-sm font-medium">{g.label}</span>
                        <i className="fa-solid fa-chevron-right text-xs text-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-teal/25 bg-teal/5 p-4 text-sm">
                  <p className="mb-2 flex items-center gap-2 font-semibold text-teal">
                    <i className={GATEWAY_ICON[order.label.toLowerCase().includes('pesa') ? 'mpesa' : order.label.toLowerCase().includes('mola') ? 'emola' : order.label.toLowerCase().includes('paypal') ? 'paypal' : 'visa']} /> {order.label}
                  </p>
                  <p className="text-ink">{order.instructions}</p>
                  <p className="mt-2 text-muted">Referência: <span className="font-mono text-ink">{order.reference}</span></p>
                </div>
                <button onClick={confirmPayment} disabled={checkoutBusy} className="btn-primary w-full">
                  {checkoutBusy ? 'A confirmar…' : order.requiresManual ? 'Já paguei' : 'Concluir pagamento'}
                </button>
                <button onClick={closeCheckout} className="btn-ghost w-full">Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
