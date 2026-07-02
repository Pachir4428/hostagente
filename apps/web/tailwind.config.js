/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // HostAgente design tokens
        bg: '#0A0711',
        surface: '#16101F',
        surface2: '#100B1A',
        card: '#110C1C',
        line: 'rgba(244,241,250,0.08)',
        ink: '#F4F1FA',
        muted: '#9C93B3',
        muted2: '#8B819B',
        teal: '#22D3AA',
        'teal-dark': '#12B58F',
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
