'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ref, setRef] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const r = new URLSearchParams(window.location.search).get('ref');
      if (r) setRef(r.toUpperCase());
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!accept) {
      setError('Precisas de aceitar os Termos e a Política de Privacidade.');
      return;
    }
    setLoading(true);
    try {
      // The API accepts a single `name`; join first + last name.
      // `phone` is collected for later (payments) but not sent on register.
      const name = `${firstName} ${lastName}`.trim();
      const res = await api.post('/auth/register', { email, password, name, businessName, ref: ref || undefined });
      setToken(res.data.accessToken);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-purple/10 blur-[140px]" />
      </div>

      {/* Left / benefits panel */}
      <div className="hidden flex-col justify-between border-r border-line bg-surface2 p-12 lg:flex">
        <Logo />
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Começa grátis<br />
            <span className="text-teal">em menos de um minuto.</span>
          </h2>
          <ul className="mt-8 space-y-3 text-muted">
            {['1 bot grátis para sempre', 'Sem cartão de crédito', 'Pagamentos em meticais'].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <span className="text-teal">✓</span> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted">
          Já tens conta?{' '}
          <Link href="/login" className="font-medium text-teal hover:underline">
            Entrar ↗
          </Link>
        </p>
      </div>

      {/* Right / form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-3xl font-bold">Criar conta</h1>
          <p className="mt-2 text-muted">Começa grátis em menos de um minuto.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {ref && (
              <div className="rounded-xl border border-teal/25 bg-teal/10 px-4 py-2.5 text-sm text-teal">
                <i className="fa-solid fa-gift mr-1" />Foste convidado com o código <b>{ref}</b>.
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">Nome</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">Apelido</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="field" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Nome do negócio</label>
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="field" placeholder="Ex: Recargas Maputo" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Número de telefone</label>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-xl border border-line bg-surface2 px-3 text-sm text-muted">🇲🇿 +258</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="field" placeholder="84 000 0000" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="tu@exemplo.co.mz" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Palavra-passe</label>
              <PasswordInput value={password} onChange={setPassword} required minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 accent-[#22D3AA]" />
              <span>
                Aceito os <span className="text-teal">Termos</span> e a <span className="text-teal">Política de Privacidade</span>.
              </span>
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'A criar…' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Já tens conta?{' '}
            <Link href="/login" className="font-medium text-teal hover:underline">
              Entrar ↗
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
