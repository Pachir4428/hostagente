'use client';

import { useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

export function PasswordInput({ value, onChange, placeholder, required, minLength, autoComplete }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="field pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
      >
        <i className={show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
      </button>
    </div>
  );
}
