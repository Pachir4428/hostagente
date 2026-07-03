'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setToken(res.data.accessToken);
      router.replace(res.data.user?.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível entrar. Verifica os dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-0 h-[500px] w-[500px] rounded-full bg-teal/10 blur-[140px]" />
      </div>

      {/* Left / brand panel */}
      <div className="hidden flex-col justify-between border-r border-line bg-surface2 p-12 lg:flex">
        <Logo />
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Os teus bots,<br />
            <span className="text-teal">sempre a trabalhar.</span>
          </h2>
          <p className="mt-4 max-w-sm text-muted">
            Automatiza o teu WhatsApp com IA e paga em meticais.
          </p>
        </div>
        <p className="text-sm text-muted">
          Ainda não tens conta?{' '}
          <Link href="/register" className="font-medium text-teal hover:underline">
            Criar conta ↗
          </Link>
        </p>
      </div>

      {/* Right / form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-3xl font-bold">Bem-vindo de volta</h1>
          <p className="mt-2 text-muted">Entra para gerir os teus bots.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="tu@exemplo.co.mz"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Palavra-passe</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Ainda não tens conta?{' '}
            <Link href="/register" className="font-medium text-teal hover:underline">
              Criar conta ↗
            </Link>
          </p>
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-muted hover:text-ink">← Voltar ao início</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
