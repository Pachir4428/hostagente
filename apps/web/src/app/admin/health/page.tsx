'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { ADMIN_NAV } from '@/lib/nav';

interface Health {
  services: { api: boolean; database: boolean; redis: boolean };
  counts: { tenants: number; users: number; botsTotal: number; botsActive: number };
  memory: { rssMB: number; heapMB: number };
  uptimeSec: number;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminHealthPage() {
  const { user } = useAuth('SUPER_ADMIN');
  const [d, setD] = useState<Health | null>(null);

  async function load() {
    try { setD((await authApi.get('/admin/platform/health')).data); } catch {}
  }
  useEffect(() => {
    if (user) { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }
  }, [user]);

  return (
    <AppShell nav={ADMIN_NAV} title="Saúde do sistema" email={user?.email} badge="Super Admin">
      {!d ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Service name="API" ok={d.services.api} />
            <Service name="Base de dados" ok={d.services.database} />
            <Service name="Redis" ok={d.services.redis} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Tenants" value={d.counts.tenants} icon="fa-building" />
            <Kpi label="Utilizadores" value={d.counts.users} icon="fa-users" />
            <Kpi label="Bots ativos" value={`${d.counts.botsActive}/${d.counts.botsTotal}`} icon="fa-robot" />
            <Kpi label="Uptime da API" value={fmtUptime(d.uptimeSec)} icon="fa-clock" />
          </div>
          <div className="card p-6">
            <h2 className="mb-3 font-display font-semibold">Recursos da API</h2>
            <p className="text-sm text-muted">Memória (RSS): <b className="text-ink">{d.memory.rssMB} MB</b> · Heap: <b className="text-ink">{d.memory.heapMB} MB</b></p>
            <p className="mt-1 text-xs text-muted2">Atualiza automaticamente a cada 10s.</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Service({ name, ok }: { name: string; ok: boolean }) {
  return (
    <div className={`card flex items-center gap-3 p-5 ${ok ? '' : 'border-danger/30'}`}>
      <span className={`h-3 w-3 rounded-full ${ok ? 'bg-teal' : 'bg-danger'} ${ok ? '' : 'animate-pulse'}`} />
      <div>
        <p className="font-display font-semibold">{name}</p>
        <p className={`text-sm ${ok ? 'text-teal' : 'text-danger'}`}>{ok ? 'Operacional' : 'Indisponível'}</p>
      </div>
    </div>
  );
}
function Kpi({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><i className={`fa-solid ${icon} text-teal`} /></div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
