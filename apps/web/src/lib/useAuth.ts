'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from './api';
import { clearToken, getToken } from './auth';

export type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'STAFF';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string | null;
}

/**
 * Loads the current user (/auth/me) and enforces access.
 * Pass `require: 'SUPER_ADMIN'` to gate super-admin pages, or 'TENANT' for
 * tenant pages. Redirects to /login when unauthenticated, or to the correct
 * home when the role doesn't match.
 */
export function useAuth(require?: 'SUPER_ADMIN' | 'TENANT') {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    authApi
      .get('/auth/me')
      .then((res) => {
        const u: AuthUser = res.data;
        setUser(u);
        if (require === 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
        } else if (require === 'TENANT' && u.role === 'SUPER_ADMIN') {
          router.replace('/admin');
        }
      })
      .catch(() => {
        clearToken();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
