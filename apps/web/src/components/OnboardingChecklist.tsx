'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
}

// Guided onboarding for new revendedores: shows the 3 essential setup steps and
// hides itself once they are all done. Non-blocking, dismissable per browser.
export function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('onboarding_done') === '1') {
      setDismissed(true);
      return;
    }
    (async () => {
      const [products, keys, bots] = await Promise.allSettled([
        authApi.get('/products'),
        authApi.get('/account/api-keys'),
        authApi.get('/bots'),
      ]);
      const count = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? (Array.isArray(r.value.data) ? r.value.data.length : (r.value.data?.keys?.length ?? 0)) : 0;
      const hasProduct = count(products) > 0;
      const hasKey =
        keys.status === 'fulfilled'
          ? Array.isArray(keys.value.data)
            ? keys.value.data.length > 0
            : !!(keys.value.data?.key || keys.value.data?.keys?.length)
          : false;
      const hasBot = count(bots) > 0;
      const s: Step[] = [
        { key: 'product', label: 'Cria o teu primeiro pacote', hint: 'Define o valor recebido → dados a entregar.', href: '/dashboard/products', cta: 'Criar pacote', done: hasProduct },
        { key: 'apikey', label: 'Configura o MacroDroid', hint: 'Copia a API key e liga o webhook de pagamentos.', href: '/dashboard/account', cta: 'Ver API key', done: hasKey },
        { key: 'bot', label: 'Cria o teu primeiro bot', hint: 'Automático (MacroDroid) ou manual (WhatsApp/Baileys).', href: '/dashboard/bots', cta: 'Criar bot', done: hasBot },
      ];
      if (s.every((x) => x.done)) {
        localStorage.setItem('onboarding_done', '1');
        setDismissed(true);
      }
      setSteps(s);
    })().catch(() => setSteps(null));
  }, []);

  if (dismissed || !steps) return null;
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="card border-teal/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-display font-semibold"><i className="fa-solid fa-rocket mr-2 text-teal" />Começar com o HostAgente</p>
          <p className="text-sm text-muted">{done} de {steps.length} passos concluídos</p>
        </div>
        <button onClick={() => { localStorage.setItem('onboarding_done', '1'); setDismissed(true); }} className="text-xs text-muted hover:text-ink">dispensar</button>
      </div>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.done ? 'border-teal/25 bg-teal/5' : 'border-line'}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${s.done ? 'bg-teal text-white' : 'bg-hover text-muted'}`}>
              {s.done ? <i className="fa-solid fa-check" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${s.done ? 'text-muted line-through' : ''}`}>{s.label}</p>
              {!s.done && <p className="text-xs text-muted">{s.hint}</p>}
            </div>
            {!s.done && (
              <Link href={s.href} className="btn-primary !px-3 !py-1.5 text-xs whitespace-nowrap">{s.cta}</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
