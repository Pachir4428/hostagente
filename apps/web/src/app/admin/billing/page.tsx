'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { mzn, dateTime } from '@/lib/format';

interface Invoice {
  id: string;
  tenant: string;
  plan: string | null;
  amount: number;
  gateway: string | null;
  reference: string | null;
  status: string;
  createdAt: string;
}

const GATEWAY_LABEL: Record<string, string> = {
  visa: 'Cartão',
  paypal: 'PayPal',
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
};
const STATUS_CHIP: Record<string, string> = {
  awaiting: 'bg-gold/10 text-gold border border-gold/25',
  pending: 'bg-hover text-muted border border-line',
};

export default function AdminBillingPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const res = await authApi.get('/admin/billing/invoices');
    setInvoices(res.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function act(id: string, action: 'confirm' | 'reject') {
    if (action === 'reject' && !confirm('Rejeitar este pagamento?')) return;
    setBusy(id + action);
    try {
      await authApi.post(`/admin/billing/invoices/${id}/${action}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falhou');
    } finally {
      setBusy('');
    }
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Pagamentos" email={user?.email}>
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-muted">
            Pagamentos manuais (M-Pesa / e-Mola) à espera de confirmação. Confirma depois de veres o valor recebido; ao confirmar, o plano do revendedor é ativado.
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Revendedor</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Sem pagamentos pendentes.</td></tr>
                ) : (
                  invoices.map((i) => (
                    <tr key={i.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 text-muted">{dateTime(i.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{i.tenant}</td>
                      <td className="px-4 py-3">{i.plan || '—'}</td>
                      <td className="px-4 py-3">{i.gateway ? GATEWAY_LABEL[i.gateway] || i.gateway : '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{i.reference || '—'}</td>
                      <td className="px-4 py-3 font-semibold">{mzn(i.amount)}</td>
                      <td className="px-4 py-3"><span className={`chip ${STATUS_CHIP[i.status] || STATUS_CHIP.pending}`}>{i.status === 'awaiting' ? 'a aguardar' : i.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => act(i.id, 'confirm')} disabled={!!busy} className="btn-primary !px-3 !py-1 text-xs">
                            {busy === i.id + 'confirm' ? '…' : 'Confirmar'}
                          </button>
                          <button onClick={() => act(i.id, 'reject')} disabled={!!busy} className="btn-danger !px-3 !py-1 text-xs">
                            {busy === i.id + 'reject' ? '…' : 'Rejeitar'}
                          </button>
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
