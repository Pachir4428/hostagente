'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearToken } from '@/lib/auth';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { AssistantWidget } from './AssistantWidget';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  soon?: boolean;
}

export function AppShell({
  nav,
  title,
  email,
  badge,
  children,
}: {
  nav: NavItem[];
  title: string;
  email?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  function logout() {
    clearToken();
    router.replace('/login');
  }

  const initial = (email || '?').charAt(0).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo size="sm" />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href;
          const inner = (
            <span
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-teal/10 font-medium text-teal'
                  : 'text-muted hover:bg-hover hover:text-ink'
              } ${item.soon ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <i className={`${item.icon} w-5 text-center`} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.soon && <span className="text-[10px] uppercase text-muted2">em breve</span>}
            </span>
          );
          return item.soon ? (
            <div key={item.href}>{inner}</div>
          ) : (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {inner}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        {email && <p className="truncate px-3 pb-2 text-xs text-muted">{email}</p>}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-hover hover:text-ink"
        >
          <i className="fa-solid fa-right-from-bracket w-5 text-center" aria-hidden="true" /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar — fixed (stays while content scrolls) */}
      <aside className="hidden border-r border-line bg-surface2 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-line bg-surface2">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/70 px-5 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted lg:hidden"
              onClick={() => setOpen(true)}
            >
              <i className="fa-solid fa-bars" aria-hidden="true" />
            </button>
            <h1 className="font-display text-lg font-bold">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {badge && (
              <span className="chip border border-line bg-hover text-muted">{badge}</span>
            )}
            <ThemeToggle />
            {/* Profile menu */}
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="grid h-9 w-9 place-items-center rounded-full bg-teal/15 font-display text-sm font-bold text-teal transition hover:bg-teal/25"
                aria-label="Perfil"
              >
                {initial}
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                    <div className="border-b border-line px-4 py-3">
                      <p className="text-xs text-muted">Sessão iniciada</p>
                      <p className="truncate text-sm font-medium">{email || '—'}</p>
                    </div>
                    <Link href="/dashboard/account" onClick={() => setMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted transition hover:bg-hover hover:text-ink">
                      <i className="fa-solid fa-user w-4 text-center" /> Conta &amp; API
                    </Link>
                    <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger transition hover:bg-hover">
                      <i className="fa-solid fa-right-from-bracket w-4 text-center" /> Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
      </div>
      <AssistantWidget />
    </div>
  );
}
