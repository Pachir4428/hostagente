'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';
import { mzn, dateTime } from '@/lib/format';

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  priceMonthly: number;
  maxTransactions: number;
  maxUsers: number;
  maxBots?: number;
  features?: string[];
  isActive: boolean;
}

const EMPTY_PLAN = { name: '', description: '', priceMonthly: '', maxTransactions: '', maxUsers: '', maxBots: '', features: '' };
interface Coupon {
  id: string;
  code: string;
  discountPct: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminPlansPage() {
  const { user, loading } = useAuth('SUPER_ADMIN');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [couponModal, setCouponModal] = useState(false);
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN });
  const [couponForm, setCouponForm] = useState({ code: '', discountPct: '', expiresAt: '' });

  async function load() {
    const [p, c] = await Promise.all([authApi.get('/admin/plans'), authApi.get('/admin/coupons')]);
    setPlans(p.data);
    setCoupons(c.data);
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function openNewPlan() {
    setEditingPlan(null);
    setPlanForm({ ...EMPTY_PLAN });
    setPlanModal(true);
  }
  function openEditPlan(p: Plan) {
    setEditingPlan(p.id);
    setPlanForm({
      name: p.name,
      description: p.description || '',
      priceMonthly: String(p.priceMonthly),
      maxTransactions: String(p.maxTransactions),
      maxUsers: String(p.maxUsers),
      maxBots: String(p.maxBots ?? 1),
      features: (p.features || []).join('\n'),
    });
    setPlanModal(true);
  }

  async function savePlan() {
    const payload = {
      name: planForm.name,
      description: planForm.description || null,
      priceMonthly: Number(planForm.priceMonthly),
      maxTransactions: Number(planForm.maxTransactions) || 0,
      maxUsers: Number(planForm.maxUsers) || 1,
      maxBots: Number(planForm.maxBots) || 1,
      features: planForm.features.split('\n').map((f) => f.trim()).filter(Boolean),
    };
    if (editingPlan) {
      await authApi.patch(`/admin/plans/${editingPlan}`, payload);
    } else {
      await authApi.post('/admin/plans', payload);
    }
    setPlanModal(false);
    setEditingPlan(null);
    setPlanForm({ ...EMPTY_PLAN });
    load();
  }
  async function togglePlan(p: Plan) {
    await authApi.patch(`/admin/plans/${p.id}`, { isActive: !p.isActive });
    load();
  }
  async function saveCoupon() {
    await authApi.post('/admin/coupons', {
      code: couponForm.code,
      discountPct: Number(couponForm.discountPct),
      expiresAt: couponForm.expiresAt || undefined,
    });
    setCouponModal(false);
    setCouponForm({ code: '', discountPct: '', expiresAt: '' });
    load();
  }
  async function toggleCoupon(c: Coupon) {
    await authApi.patch(`/admin/coupons/${c.id}/toggle`);
    load();
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Planos & Cupões" email={user?.email} badge="Super Admin">
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Planos</h2>
              <button onClick={openNewPlan} className="btn-primary"><i className="fa-solid fa-plus" /> Novo plano</button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((p) => (
                <div key={p.id} className={`card p-5 ${!p.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">{p.name}</h3>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditPlan(p)} className="text-xs text-muted hover:text-teal" title="Editar"><i className="fa-solid fa-pen" /></button>
                      <button onClick={() => togglePlan(p)} className="text-xs text-teal hover:underline">
                        {p.isActive ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                  {p.description && <p className="mt-1 text-xs text-muted">{p.description}</p>}
                  <p className="mt-2 font-display text-2xl font-bold">{mzn(p.priceMonthly)}<span className="text-sm font-normal text-muted">/mês</span></p>
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    <li><i className="fa-solid fa-check mr-2 text-teal" />{p.maxTransactions} transações/mês</li>
                    <li><i className="fa-solid fa-check mr-2 text-teal" />{p.maxUsers} utilizador(es)</li>
                    <li><i className="fa-solid fa-check mr-2 text-teal" />{p.maxBots ?? 1} bot(s)</li>
                    {(p.features || []).map((f) => (
                      <li key={f}><i className="fa-solid fa-check mr-2 text-teal" />{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Cupões</h2>
              <button onClick={() => setCouponModal(true)} className="btn-primary">+ Novo cupão</button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Desconto</th>
                    <th className="px-4 py-3 font-medium">Expira</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Sem cupões.</td></tr>
                  ) : coupons.map((c) => (
                    <tr key={c.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 font-mono">{c.code}</td>
                      <td className="px-4 py-3">{c.discountPct}%</td>
                      <td className="px-4 py-3 text-muted">{c.expiresAt ? dateTime(c.expiresAt) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`chip ${c.active ? 'bg-teal/10 text-teal border border-teal/25' : 'bg-hover text-muted border border-line'}`}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleCoupon(c)} className="text-xs text-teal hover:underline">
                          {c.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {planModal && (
        <Modal title={editingPlan ? 'Editar plano' : 'Novo plano'} onClose={() => setPlanModal(false)} onSave={savePlan}
          disabled={!planForm.name || planForm.priceMonthly === ''}>
          <Field label="Nome" value={planForm.name} onChange={(v) => setPlanForm({ ...planForm, name: v })} />
          <Field label="Descrição (opcional)" value={planForm.description} onChange={(v) => setPlanForm({ ...planForm, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço mensal (MZN)" type="number" value={planForm.priceMonthly} onChange={(v) => setPlanForm({ ...planForm, priceMonthly: v })} />
            <Field label="Máx. transações/mês" type="number" value={planForm.maxTransactions} onChange={(v) => setPlanForm({ ...planForm, maxTransactions: v })} />
            <Field label="Máx. utilizadores" type="number" value={planForm.maxUsers} onChange={(v) => setPlanForm({ ...planForm, maxUsers: v })} />
            <Field label="Máx. bots" type="number" value={planForm.maxBots} onChange={(v) => setPlanForm({ ...planForm, maxBots: v })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Funcionalidades (uma por linha)</label>
            <textarea value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} className="field min-h-[90px]" placeholder={'Suporte prioritário\nAPI dedicada\nIA avançada'} />
          </div>
        </Modal>
      )}
      {couponModal && (
        <Modal title="Novo cupão" onClose={() => setCouponModal(false)} onSave={saveCoupon}
          disabled={!couponForm.code || !couponForm.discountPct}>
          <Field label="Código" value={couponForm.code} onChange={(v) => setCouponForm({ ...couponForm, code: v })} />
          <Field label="Desconto (%)" type="number" value={couponForm.discountPct} onChange={(v) => setCouponForm({ ...couponForm, discountPct: v })} />
          <Field label="Expira (opcional)" type="date" value={couponForm.expiresAt} onChange={(v) => setCouponForm({ ...couponForm, expiresAt: v })} />
        </Modal>
      )}
    </AppShell>
  );
}

function Modal({ title, children, onClose, onSave, disabled }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <div className="mt-6 space-y-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={onSave} disabled={disabled} className="btn-primary">Guardar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: any) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="field" />
    </div>
  );
}
