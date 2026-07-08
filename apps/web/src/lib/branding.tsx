'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

export interface Branding {
  appName: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  landing?: {
    badge?: string;
    heroTitle?: string;
    heroHighlight?: string;
    heroSubtitle?: string;
    ctaText?: string;
    features?: { icon?: string; title?: string; desc?: string }[];
    footerNote?: string;
  };
}

const DEFAULT: Branding = { appName: 'HostAgente', primaryColor: '#22D3AA' };

const BrandingContext = createContext<Branding>(DEFAULT);
export const useBranding = () => useContext(BrandingContext);

function hexToRgbChannels(hex?: string): string | null {
  if (!hex) return null;
  const m = hex.replace('#', '').trim();
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `${r} ${g} ${b}`;
}

// Apply brand primary colour, favicon and document title at runtime.
export function applyBranding(b: Branding) {
  if (typeof document === 'undefined') return;
  const rgb = hexToRgbChannels(b.primaryColor);
  if (rgb) {
    document.documentElement.style.setProperty('--c-teal', rgb);
    // Darker shade for hover: scale channels ~85%.
    const dark = rgb.split(' ').map((n) => Math.round(Number(n) * 0.82)).join(' ');
    document.documentElement.style.setProperty('--c-teal-dark', dark);
  }
  if (b.appName) document.title = b.appName;
  if (b.favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.favicon;
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT);

  useEffect(() => {
    api
      .get('/branding')
      .then((r) => {
        const b: Branding = { ...DEFAULT, ...r.data };
        setBranding(b);
        applyBranding(b);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}
