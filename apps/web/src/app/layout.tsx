import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HostAgente — Bots de WhatsApp com IA',
  description: 'Automatiza o teu WhatsApp com IA e paga em meticais. M-Pesa · e-Mola · mKesh.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
