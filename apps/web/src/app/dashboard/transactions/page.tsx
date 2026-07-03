'use client';

import { useCallback, useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { mzn, dateTime, TX_STATUS, OPERATOR_LABEL } from '@/lib/format';

interface Tx {
  id: string;
  phoneNumber: string;
  amount: number;
  operator: string;
  status: string;
  createdAt: string;
  product?: { description: string; megabytes?: number } | null;
}

export default function TransactionsPage() {
  const { user, loading } = useAuth('TENANT');
  const [items, setItems] = useState<Tx[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (p = 1) => {
      setBusy(true);
      try {
        const res = await authApi.get('/transactions', {
          params: { page: p, pageSize: 20, phone, status, from, to },
        });
        setItems(res.data.items);
        setPage(res.data.page);
        setPages(res.data.pages);
        setTotal(res.data.total);
      } finally {
        setBusy(false);
      }
    },
    [phone, status, from, to],
  );

  useEffect(() => {
    if (user) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function exportCsv() {
    const header = ['Data', 'Numero', 'Valor', 'Operadora', 'Estado', 'Pacote'];
    const rows = items.map((t) => [
      dateTime(t.createdAt),
      t.phoneNumber,
      t.amount,
      OPERATOR_LABEL[t.operator] ?? t.operator,
      TX_STATUS[t.status]?.label ?? t.status,
      t.product?.description ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell nav={TENANT_NAV} title="Vendas" email={user?.email}>
      {/* Filters */}
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Número</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field !w-40" placeholder="84…" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field !w-40">
            <option value="">Todos</option>
            <option value="delivered">Entregue</option>
            <option value="refused">Recusado</option>
            <option value="duplicate">Duplicado</option>
            <option value="pending">Pendente</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field !w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field !w-40" />
        </div>
        <button onClick={() => load(1)} className="btn-primary">Filtrar</button>
        <button onClick={exportCsv} className="btn-ghost">Exportar CSV</button>
        <span className="ml-auto self-center text-sm text-muted">{total} transações</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Operadora</th>
                <th className="px-4 py-3 font-medium">Pacote</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading || busy ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">A carregar…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Sem transações.</td></tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-muted">{dateTime(t.createdAt)}</td>
                    <td className="px-4 py-3 font-mono">{t.phoneNumber}</td>
                    <td className="px-4 py-3 font-semibold">{mzn(t.amount)}</td>
                    <td className="px-4 py-3">{OPERATOR_LABEL[t.operator] ?? t.operator}</td>
                    <td className="px-4 py-3 text-muted">{t.product?.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${TX_STATUS[t.status]?.chip}`}>
                        {TX_STATUS[t.status]?.label ?? t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="btn-ghost !px-3 !py-1.5">←</button>
          <span className="text-sm text-muted">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="btn-ghost !px-3 !py-1.5">→</button>
        </div>
      )}
    </AppShell>
  );
}
