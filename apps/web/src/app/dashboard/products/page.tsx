'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { mzn, OPERATOR_LABEL } from '@/lib/format';

interface Product {
  id: string;
  amount: number;
  description: string;
  megabytes?: number | null;
  operator?: string | null;
  autoDetect: boolean;
  active: boolean;
}

const empty = { amount: '', description: '', megabytes: '', operator: '', autoDetect: true };

export default function ProductsPage() {
  const { user, loading } = useAuth('TENANT');
  const [items, setItems] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await authApi.get('/products');
    setItems(res.data);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      amount: String(p.amount),
      description: p.description,
      megabytes: p.megabytes ? String(p.megabytes) : '',
      operator: p.operator ?? '',
      autoDetect: p.autoDetect,
    });
    setShowModal(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        amount: Number(form.amount),
        description: form.description,
        megabytes: form.megabytes ? Number(form.megabytes) : null,
        operator: form.operator || null,
        autoDetect: form.autoDetect,
      };
      if (editing) await authApi.patch(`/products/${editing.id}`, payload);
      else await authApi.post('/products', payload);
      setShowModal(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Não foi possível guardar o pacote');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    await authApi.patch(`/products/${p.id}`, { active: !p.active });
    load();
  }

  return (
    <AppShell nav={TENANT_NAV} title="Pacotes" email={user?.email}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted">Cada pacote é entregue quando chega um pagamento com o valor definido.</p>
        <button onClick={openCreate} className="btn-primary">+ Novo pacote</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-xl">▤</div>
          <p className="mt-4 font-display font-semibold">Ainda não tens pacotes</p>
          <button onClick={openCreate} className="btn-primary mt-6">+ Criar primeiro pacote</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className={`card p-5 ${!p.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <span className="font-display text-2xl font-bold text-teal">{mzn(p.amount)}</span>
                <span className="chip border border-line bg-white/[0.03] text-muted">
                  {p.operator ? OPERATOR_LABEL[p.operator] : 'Todas'}
                </span>
              </div>
              <p className="mt-2 font-medium">{p.description}</p>
              {p.megabytes && <p className="text-sm text-muted">{p.megabytes} MB</p>}
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className={p.autoDetect ? 'text-teal' : 'text-muted'}>
                  ● Deteção {p.autoDetect ? 'ativa' : 'off'}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openEdit(p)} className="btn-ghost !px-3 !py-1.5 text-sm">Editar</button>
                <button onClick={() => toggleActive(p)} className="btn-ghost !px-3 !py-1.5 text-sm">
                  {p.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">{editing ? 'Editar pacote' : 'Novo pacote'}</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">Valor (MZN)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="field" placeholder="50" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Descrição</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field" placeholder="Diário 1GB" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm text-muted">MB (opcional)</label>
                  <input type="number" value={form.megabytes} onChange={(e) => setForm({ ...form, megabytes: e.target.value })} className="field" placeholder="1024" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Operadora</label>
                  <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="field">
                    <option value="">Todas</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="emola">e-Mola</option>
                    <option value="mkesh">mKesh</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={form.autoDetect} onChange={(e) => setForm({ ...form, autoDetect: e.target.checked })} className="accent-[#22D3AA]" />
                Deteção automática por valor
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.amount || !form.description} className="btn-primary">
                {saving ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
