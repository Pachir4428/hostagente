'use client';

import { BrandingProvider } from '@/lib/branding';

export function Providers({ children }: { children: React.ReactNode }) {
  return <BrandingProvider>{children}</BrandingProvider>;
}
