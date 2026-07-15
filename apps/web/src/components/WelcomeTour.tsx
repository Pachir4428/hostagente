'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { icon: 'fa-hand-sparkles', title: 'Bem-vindo ao HostAgente! 👋', text: 'Vamos mostrar-te o essencial em 4 passos rápidos. Podes saltar a qualquer momento.' },
  { icon: 'fa-box', title: '1. Cria os teus pacotes', text: 'Em Pacotes defines "valor recebido → dados a entregar". É a base de tudo.', href: '/dashboard/products', cta: 'Ir a Pacotes' },
  { icon: 'fa-robot', title: '2. Cria um bot', text: 'Em Bots cria um bot automático (MacroDroid) ou manual (WhatsApp). Descarrega o bot-modelo ou a ponte de pagamentos com 1 clique.', href: '/dashboard/bots', cta: 'Ir a Bots' },
  { icon: 'fa-wand-magic-sparkles', title: '3. Gera código sem código', text: 'No Gerador crias comandos e nanos para o teu bot e guardas direto nele. E se precisares de ajuda, tens o assistente e os Guias.', href: '/dashboard/gerador', cta: 'Abrir Gerador' },
];

export function WelcomeTour() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('welcome_done')) {
      setShow(true);
    }
  }, []);

  function done() {
    localStorage.setItem('welcome_done', '1');
    setShow(false);
  }
  function go(href?: string) {
    done();
    if (href) router.push(href);
  }

  if (!show) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal/10 text-3xl text-teal"><i className={`fa-solid ${s.icon}`} /></span>
        <h2 className="mt-4 font-display text-xl font-bold">{s.title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{s.text}</p>

        <div className="mt-5 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-teal' : 'w-1.5 bg-line'}`} />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={done} className="text-xs text-muted hover:text-ink">Saltar</button>
          <div className="flex gap-2">
            {s.href && (
              <button onClick={() => go(s.href)} className="btn-ghost text-sm">{s.cta}</button>
            )}
            {last ? (
              <button onClick={done} className="btn-primary text-sm">Começar</button>
            ) : (
              <button onClick={() => setStep(step + 1)} className="btn-primary text-sm">Seguinte</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
