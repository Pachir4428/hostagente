'use client';

import { useState } from 'react';

// A curated set of common Font Awesome (free) icons for personalising cards,
// features, etc. Users can also type any FA class manually.
const ICONS = [
  'fa-solid fa-bolt', 'fa-solid fa-box', 'fa-solid fa-boxes-stacked', 'fa-solid fa-chart-line',
  'fa-solid fa-chart-simple', 'fa-solid fa-bell', 'fa-solid fa-lock', 'fa-solid fa-shield-halved',
  'fa-solid fa-robot', 'fa-solid fa-comment-dots', 'fa-solid fa-mobile-screen', 'fa-solid fa-sim-card',
  'fa-solid fa-money-bill-wave', 'fa-solid fa-wallet', 'fa-solid fa-credit-card', 'fa-solid fa-coins',
  'fa-solid fa-rocket', 'fa-solid fa-gauge-high', 'fa-solid fa-clock', 'fa-solid fa-globe',
  'fa-solid fa-wifi', 'fa-solid fa-signal', 'fa-solid fa-headset', 'fa-solid fa-users',
  'fa-solid fa-user-shield', 'fa-solid fa-gear', 'fa-solid fa-cloud', 'fa-solid fa-database',
  'fa-solid fa-fire', 'fa-solid fa-star', 'fa-solid fa-heart', 'fa-solid fa-check',
  'fa-solid fa-wand-magic-sparkles', 'fa-solid fa-tags', 'fa-solid fa-paper-plane', 'fa-solid fa-flag',
  'fa-brands fa-whatsapp', 'fa-brands fa-cc-visa', 'fa-brands fa-paypal', 'fa-brands fa-android',
];

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const isFa = value?.startsWith('fa-');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-lg text-teal transition hover:border-teal/40"
        title="Escolher ícone"
      >
        {isFa ? <i className={value} /> : <span>{value || '★'}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-50 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl">
            <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => { onChange(ic); setOpen(false); }}
                  className={`grid h-9 w-9 place-items-center rounded-lg text-sm transition hover:bg-hover ${value === ic ? 'bg-teal/15 text-teal' : 'text-muted'}`}
                  title={ic}
                >
                  <i className={ic} />
                </button>
              ))}
            </div>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="ou classe FA / emoji"
              className="field mt-2 text-xs"
            />
          </div>
        </>
      )}
    </div>
  );
}

// Render helper: shows a Font Awesome icon when the value is an FA class,
// otherwise renders the raw value (emoji/text).
export function renderIcon(value?: string, className = '') {
  if (!value) return null;
  if (value.startsWith('fa-')) return <i className={`${value} ${className}`} />;
  return <span className={className}>{value}</span>;
}
