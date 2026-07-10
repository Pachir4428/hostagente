'use client';

import { BrandingProvider } from '@/lib/branding';
import { PwaBridge } from '@/components/PwaBridge';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrandingProvider>
      <PwaBridge />
      {children}
    </BrandingProvider>
  );
}
