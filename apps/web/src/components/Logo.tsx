'use client';

import { useBranding } from '@/lib/branding';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const brand = useBranding();
  const box = size === 'sm' ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg';
  const text = size === 'sm' ? 'text-base' : 'text-lg';
  const name = brand.appName || 'HostAgente';
  const initial = name.charAt(0).toUpperCase();

  // Split names like "HostAgente" so the CamelCase tail is highlighted;
  // single-word names stay plain.
  const m = name.match(/^(\S*?)([A-Z]\S*)$/);
  const head = m ? m[1] : name;
  const tail = m ? m[2] : '';

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt={name} className={`rounded-xl object-contain ${box}`} />
      ) : (
        <span className={`grid place-items-center rounded-xl bg-teal font-display font-bold text-teal-ink ${box}`}>
          {initial}
        </span>
      )}
      <span className={`font-display font-bold tracking-tight ${text}`}>
        {head}
        {tail && <span className="text-teal">{tail}</span>}
      </span>
    </span>
  );
}
