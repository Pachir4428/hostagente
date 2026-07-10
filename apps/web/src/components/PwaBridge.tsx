'use client';

import { useEffect, useRef } from 'react';
import { authApi } from '@/lib/api';
import { getToken } from '@/lib/auth';

// Registers the service worker (makes the app installable) and, while the app
// is open, shows a browser notification when the unread panel count increases.
// (Background push needs VAPID keys + subscriptions — a later phase.)
export function PwaBridge() {
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if ('Notification' in window && Notification.permission === 'default') {
      // Ask lazily (non-blocking); browsers may defer until a user gesture.
      setTimeout(() => Notification.requestPermission().catch(() => {}), 3000);
    }

    let stopped = false;
    async function poll() {
      if (stopped || !getToken()) return;
      try {
        const res = await authApi.get('/notifications/unread-count');
        const count = typeof res.data === 'number' ? res.data : res.data?.count ?? 0;
        if (lastCount.current !== null && count > lastCount.current && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('HostAgente', { body: `Tens ${count} notificação(ões) por ler.`, icon: '/icon.svg' });
        }
        lastCount.current = count;
      } catch {
        /* ignore */
      }
    }
    const iv = setInterval(poll, 30000);
    poll();
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, []);

  return null;
}
