'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  canEdit: boolean;
  createdAt: string;
}

export default function TeamPage() {
  const { user, loading } = useAuth('TENANT');
  const [members, setMembers] = useState<Member[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', canEdit: false });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await authApi.get('/team');
    setMembers(res.data);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function invite() {
    setSaving(true);
    try {
      await authApi.post('/team', form);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', canEdit: false });
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Não foi possível adicionar o membro');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEdit(m: Member) {
    await authApi.patch(`/team/${m.id}`, { canEdit: !m.canEdit });
    load();
  }

  async function remove(m: Member) {
    if (!confirm(`Remover ${m.name}?`)) return;
    await authApi.delete(`/team/${m.id}`);
    load();
  }

  return (
    <AppShell nav={TENANT_NAV} title="Equipa" email={user?.email}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted">Convida colaboradores e define se podem ver ou editar.</p>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Adicionar</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Permissão</th>
                <th className="px-4 py-3 font-medium">Desde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className="chip border border-line bg-hover text-muted">
                      {m.role === 'TENANT_ADMIN' ? 'Admin' : 'Colaborador'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === 'TENANT_ADMIN' ? (
                      <span className="text-teal">Total</span>
                    ) : (
                      <span className={m.canEdit ? 'text-teal' : 'text-muted'}>
                        {m.canEdit ? 'Editar' : 'Ver'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{dateTime(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    {m.role !== 'TENANT_ADMIN' && (
                      <div className="flex gap-2">
                        <button onClick={() => toggleEdit(m)} className="text-xs text-teal hover:underline">
                          {m.canEdit ? 'Só ver' : 'Deixar editar'}
                        </button>
                        <button onClick={() => remove(m)} className="text-xs text-danger hover:underline">
                          Remover
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Adicionar colaborador</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">Nome</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">Palavra-passe</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="field" placeholder="Mínimo 6 caracteres" />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={form.canEdit} onChange={(e) => setForm({ ...form, canEdit: e.target.checked })} className="accent-[#22D3AA]" />
                Pode editar (não só ver)
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={invite} disabled={saving || !form.email || !form.password || !form.name} className="btn-primary">
                {saving ? 'A adicionar…' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
