'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { dateTime } from '@/lib/format';

interface Data {
  code: string;
  count: number;
  active: number;
  referred: { name: string; status: string; createdAt: string }[];
}

export default function ReferralsPage() {
  const { user, loading } = useAuth('TENANT');
  const [d, setD] = useState<Data | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (user) authApi.get('/referrals').then((r) => setD(r.data)).catch(() => {});
  }, [user]);

  const link = typeof window !== 'undefined' && d ? `${window.location.origin}/register?ref=${d.code}` : '';
  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  return (
    <AppShell nav={TENANT_NAV} title="Convidar & Ganhar" email={user?.email}>
      {loading || !d ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal" /></div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold"><i className="fa-solid fa-gift mr-2 text-teal" />Convida outros revendedores</h2>
            <p className="mt-1 text-sm text-muted">Partilha o teu link. Por cada revendedor que se registar e ficar ativo, ganhas recompensas (desconto/comissão).</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="rounded-xl border border-line bg-hover px-5 py-4 text-center">
                <p className="text-xs text-muted">O teu código</p>
                <p className="font-mono text-2xl font-bold tracking-widest text-teal">{d.code || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-xs text-muted">Link de convite</p>
                <div className="flex gap-2">
                  <input readOnly value={link} className="field flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <button onClick={() => copy(link, 'link')} className="btn-primary whitespace-nowrap">{copied === 'link' ? 'Copiado ✓' : 'Copiar'}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`https://wa.me/?text=${encodeURIComponent('Junta-te ao HostAgente e vende dados no automático: ' + link)}`} target="_blank" rel="noreferrer" className="btn-ghost text-sm"><i className="fa-brands fa-whatsapp text-teal" /> Partilhar no WhatsApp</a>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5"><p className="text-sm text-muted">Convidados</p><p className="mt-1 font-display text-3xl font-bold">{d.count}</p></div>
            <div className="card p-5"><p className="text-sm text-muted">Ativos</p><p className="mt-1 font-display text-3xl font-bold text-teal">{d.active}</p></div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Quem convidaste</h2>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="px-4 py-3 font-medium">Revendedor</th>
                    <th className="px-4 py-3 font-medium">Registo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.referred.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">Ainda não convidaste ninguém. Partilha o teu link!</td></tr>
                  ) : (
                    d.referred.map((r, i) => (
                      <tr key={i} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-muted">{dateTime(r.createdAt)}</td>
                        <td className="px-4 py-3"><span className={`chip ${r.status === 'active' ? 'bg-teal/10 text-teal border border-teal/25' : 'bg-hover text-muted border border-line'}`}>{r.status}</span></td>
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
