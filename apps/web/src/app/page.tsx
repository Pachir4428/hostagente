'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { Logo } from '@/components/Logo';

const features = [
  { icon: '🤖', title: 'IA a responder 24/7', desc: 'Escolhe entre 3 modelos de IA para responder aos teus clientes automaticamente, a qualquer hora.' },
  { icon: '💬', title: 'WhatsApp nativo', desc: 'Liga o teu número por QR code ou código de emparelhamento. Sem APIs complicadas.' },
  { icon: '🇲🇿', title: 'Pagamentos em meticais', desc: 'Recebe e paga com M-Pesa, e-Mola e mKesh. Feito para Moçambique.' },
  { icon: '⚡', title: 'Bots isolados', desc: 'Cada bot corre no seu próprio container seguro, sempre online.' },
  { icon: '📊', title: 'Painel em tempo real', desc: 'Acompanha o estado dos teus bots ao vivo, com estatísticas de mensagens.' },
  { icon: '🔒', title: 'Seguro por defeito', desc: 'Sessões encriptadas e dados protegidos. O teu WhatsApp, sob o teu controlo.' },
];

const steps = [
  { n: '1', title: 'Cria a tua conta', desc: 'Grátis, em menos de um minuto. Sem cartão de crédito.' },
  { n: '2', title: 'Cria um bot', desc: 'Dá-lhe um nome e escolhe o modelo de IA.' },
  { n: '3', title: 'Liga o WhatsApp', desc: 'Aponta a câmara ao QR code ou usa o código de emparelhamento.' },
  { n: '4', title: 'Está online', desc: 'O teu bot começa a responder automaticamente. É só isto.' },
];

const plans = [
  { name: 'FREE', price: '0', period: 'para sempre', highlight: false, features: ['1 bot', 'IA básica', 'Suporte comunitário'] },
  { name: 'PRO', price: '750', period: '/mês', highlight: true, features: ['Bots ilimitados', 'IA avançada', 'Pagamentos M-Pesa/e-Mola/mKesh', 'Suporte prioritário'] },
  { name: 'BUSINESS', price: '2.500', period: '/mês', highlight: false, features: ['Tudo do PRO', 'API dedicada', 'Múltiplos utilizadores', 'SLA 99.9%'] },
];

const faqs = [
  { q: 'Preciso de cartão de crédito?', a: 'Não. O plano gratuito não pede cartão e podes começar já. Nos planos pagos usamos M-Pesa, e-Mola e mKesh.' },
  { q: 'Como ligo o meu WhatsApp?', a: 'Depois de criar um bot, aparece um QR code (ou código de emparelhamento) que ligas no teu WhatsApp em Aparelhos ligados.' },
  { q: 'Os meus dados estão seguros?', a: 'Sim. Cada bot corre isolado no seu container e as sessões são encriptadas.' },
  { q: 'Posso ter vários bots?', a: 'No plano gratuito tens 1 bot. Nos planos PRO e BUSINESS podes ter bots ilimitados.' },
];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-teal/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-purple/10 blur-[130px]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
            <a href="#features" className="transition hover:text-ink">Funcionalidades</a>
            <a href="#how" className="transition hover:text-ink">Como funciona</a>
            <a href="#pricing" className="transition hover:text-ink">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            {authed ? (
              <Link href="/dashboard" className="btn-primary text-sm">Painel</Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm font-medium text-muted transition hover:text-ink sm:inline">
                  Entrar
                </Link>
                <Link href="/register" className="btn-primary text-sm">Começar grátis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 text-center">
        <span className="chip mx-auto border border-line bg-white/[0.03] text-muted">
          Feito para Moçambique · M-Pesa · e-Mola · mKesh
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Os teus bots de <span className="text-teal">WhatsApp</span>,<br className="hidden sm:block" /> sempre online.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Automatiza o teu WhatsApp com IA e paga em meticais. Do zero ao bot online em menos de um minuto.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary">Criar conta grátis →</Link>
          <a href="#pricing" className="btn-ghost">Ver planos</a>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4">
          {[
            { v: '99.9%', l: 'Uptime' },
            { v: '3', l: 'Modelos de IA' },
            { v: '<60s', l: 'Para ligar' },
          ].map((s) => (
            <div key={s.l} className="card px-4 py-6">
              <div className="font-display text-3xl font-bold text-teal">{s.v}</div>
              <div className="mt-1 text-sm text-muted">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Tudo o que precisas</h2>
          <p className="mt-3 text-muted">Uma plataforma, poderes completos.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6 transition hover:border-teal/30">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal/10 text-xl">{f.icon}</div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Do zero ao bot online em 4 passos</h2>
          <p className="mt-3 text-muted">Simples.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-teal font-display font-bold text-teal-ink">{s.n}</div>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Preços em meticais</h2>
          <p className="mt-3 text-muted">Escolhe o teu plano.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`card relative flex flex-col p-7 ${p.highlight ? 'border-teal/40 shadow-glow' : ''}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal px-3 py-1 text-xs font-bold text-teal-ink">
                  MAIS POPULAR
                </span>
              )}
              <h3 className="font-display text-lg font-semibold">Plano {p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className="text-muted">MZN {p.period}</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-muted">
                    <span className="text-teal">✓</span> {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-7 w-full ${p.highlight ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p.name === 'FREE' ? 'Começar grátis' : 'Escolher plano'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Perguntas frequentes</h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display font-semibold">
                {f.q}
                <span className="text-teal transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="card overflow-hidden p-10 text-center shadow-glow sm:p-16">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Pronto para automatizar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Cria a tua conta grátis — sem cartão, sem complicações.
          </p>
          <Link href="/register" className="btn-primary mt-8">Começar agora →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row">
          <Logo size="sm" />
          <p>© 2026 HostAgente · Maputo, Moçambique · Feito com meticais 🇲🇿</p>
        </div>
      </footer>
    </div>
  );
}
