'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBranding } from '@/lib/branding';
import { renderIcon } from '@/components/IconPicker';
import { CodeGenerator } from '@/components/CodeGenerator';

const features = [
  { icon: 'fa-solid fa-bolt', title: 'Deteção automática', desc: 'O MacroDroid lê o SMS de M-Pesa/e-Mola e a venda é registada em segundos, sem toques.' },
  { icon: 'fa-solid fa-box', title: 'Catálogo de pacotes', desc: 'Define valor → pacote de dados. Cada pagamento reconhecido entrega o pacote certo.' },
  { icon: 'fa-solid fa-mobile-screen', title: 'Feito para Moçambique', desc: 'M-Pesa, e-Mola e mKesh. Recebe e concilia tudo em meticais.' },
  { icon: 'fa-solid fa-chart-line', title: 'Painel em tempo real', desc: 'Vendas de hoje, receita, histórico completo e estado do MacroDroid ao vivo.' },
  { icon: 'fa-solid fa-bell', title: 'Alertas inteligentes', desc: 'Avisos de falhas de rede, pagamentos não reconhecidos e subscrição a expirar.' },
  { icon: 'fa-solid fa-lock', title: 'Multi-tenant seguro', desc: 'Cada revendedor tem os seus dados isolados e a sua chave de API própria.' },
];

const steps = [
  { n: '1', title: 'Cria a tua conta', desc: 'Grátis, em menos de um minuto. Trial de 14 dias.' },
  { n: '2', title: 'Define os pacotes', desc: 'Valor recebido → pacote de dados a entregar.' },
  { n: '3', title: 'Liga o MacroDroid', desc: 'Cola a tua chave de API e o endpoint no MacroDroid do telemóvel.' },
  { n: '4', title: 'Vende no automático', desc: 'Cada pagamento detetado vira uma venda registada. É só isto.' },
];

const plans = [
  { name: 'FREE', price: '0', period: 'para sempre', highlight: false, features: ['1 bot', 'IA básica', 'Suporte comunitário'] },
  { name: 'PRO', price: '750', period: '/mês', highlight: true, features: ['Bots ilimitados', 'IA avançada', 'Pagamentos M-Pesa/e-Mola/mKesh', 'Suporte prioritário'] },
  { name: 'BUSINESS', price: '2.500', period: '/mês', highlight: false, features: ['Tudo do PRO', 'API dedicada', 'Múltiplos utilizadores', 'SLA 99.9%'] },
];

const faqs = [
  { q: 'Preciso de cartão de crédito?', a: 'Não. Começas com 14 dias de trial e sem cartão. Nos planos pagos usamos M-Pesa, e-Mola e mKesh.' },
  { q: 'O que é o MacroDroid?', a: 'É uma app Android que automatiza ações. Configuras um gatilho no SMS de pagamento que envia os dados para a HostAgente através da tua chave de API.' },
  { q: 'Como é detetado o pagamento?', a: 'Quando chega o SMS de M-Pesa/e-Mola, o MacroDroid envia o valor e o número. A HostAgente encontra o pacote pelo valor e regista a venda.' },
  { q: 'Os meus dados estão seguros?', a: 'Sim. Cada revendedor (tenant) tem os seus dados isolados e uma chave de API própria que podes regenerar a qualquer momento.' },
];

export default function Home() {
  const brand = useBranding();
  const L = brand.landing || {};
  const feats = L.features && L.features.length ? L.features : features;
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
            <a href="#gerador" className="transition hover:text-ink">Gerador grátis</a>
            <a href="#how" className="transition hover:text-ink">Como funciona</a>
            <a href="#pricing" className="transition hover:text-ink">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
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
        <span className="chip mx-auto border border-line bg-hover text-muted">
          {L.badge || 'Feito para Moçambique · M-Pesa · e-Mola · mKesh'}
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-[2rem] font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
          {L.heroTitle || 'Vende dados no'}{' '}
          <span className="bg-gradient-to-r from-teal to-purple bg-clip-text text-transparent">{L.heroHighlight || 'automático'}</span>
          {L.heroTitle ? '' : ', a cada pagamento.'}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          {L.heroSubtitle ||
            'Deteta pagamentos M-Pesa e e-Mola com o MacroDroid e entrega pacotes de dados automaticamente. Feito para revendedores em Moçambique.'}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary">{L.ctaText || 'Criar conta grátis'} →</Link>
          <a href="#pricing" className="btn-ghost">Ver planos</a>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4">
          {[
            { v: '<5s', l: 'Deteção → venda' },
            { v: '3', l: 'Operadoras' },
            { v: '24/7', l: 'Automático' },
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
          {feats.map((f, i) => (
            <div key={f.title || i} className="card p-6 transition hover:border-teal/30">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal/10 text-xl text-teal">{renderIcon(f.icon)}</div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Free code generator (lead magnet) */}
      <section id="gerador" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <span className="chip mx-auto border border-teal/25 bg-teal/10 text-teal">Grátis</span>
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Gera código para o teu bot WhatsApp</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">Cria comandos Baileys e nanos em segundos. Experimenta grátis — depois cria conta para gerar sem limite e <b>hospedar os teus bots</b>.</p>
        </div>
        <div className="mt-10">
          <CodeGenerator gated freeUses={2} />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Do zero a vender em 4 passos</h2>
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
          <p>{L.footerNote || '© 2026 HostAgente · Maputo, Moçambique · Feito com meticais 🇲🇿'}</p>
        </div>
      </footer>
    </div>
  );
}
