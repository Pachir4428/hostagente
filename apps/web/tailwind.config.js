/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — driven by CSS variables (see globals.css) so they
        // flip between light and dark themes.
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        surface2: 'var(--c-surface2)',
        card: 'var(--c-card)',
        line: 'var(--c-line)',
        ink: 'var(--c-ink)',
        muted: 'var(--c-muted)',
        muted2: 'var(--c-muted2)',
        hover: 'var(--c-hover)',
        // Brand colors — driven by CSS vars so the super admin can white-label
        // the primary colour at runtime. RGB channels keep /opacity utilities working.
        teal: 'rgb(var(--c-teal) / <alpha-value>)',
        'teal-dark': 'rgb(var(--c-teal-dark) / <alpha-value>)',
        'teal-ink': '#04120D',
        purple: '#8B5CF6',
        'purple-soft': '#C9B8FF',
        gold: '#F5B13D',
        danger: '#F87171',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,170,0.25), 0 8px 40px -12px rgba(34,211,170,0.35)',
      },
    },
  },
  plugins: [],
};
