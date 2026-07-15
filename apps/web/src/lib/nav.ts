import type { NavItem } from '@/components/AppShell';

export const TENANT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Resumo', icon: 'fa-solid fa-gauge-high' },
  { href: '/dashboard/transactions', label: 'Vendas', icon: 'fa-solid fa-arrow-right-arrow-left' },
  { href: '/dashboard/insights', label: 'Insights', icon: 'fa-solid fa-chart-pie' },
  { href: '/dashboard/bots', label: 'Bots', icon: 'fa-solid fa-robot' },
  { href: '/dashboard/gerador', label: 'Gerador de código', icon: 'fa-solid fa-wand-magic-sparkles' },
  { href: '/dashboard/grupos', label: 'Grupos', icon: 'fa-brands fa-whatsapp' },
  { href: '/dashboard/products', label: 'Pacotes', icon: 'fa-solid fa-box' },
  { href: '/dashboard/account', label: 'Conta & API', icon: 'fa-solid fa-gear' },
  { href: '/dashboard/subscription', label: 'Assinatura', icon: 'fa-solid fa-star' },
  { href: '/dashboard/notifications', label: 'Notificações', icon: 'fa-solid fa-bell' },
  { href: '/dashboard/team', label: 'Equipa', icon: 'fa-solid fa-users' },
  { href: '/dashboard/referrals', label: 'Convidar & Ganhar', icon: 'fa-solid fa-gift' },
  { href: '/dashboard/ajuda', label: 'Ajuda & Guias', icon: 'fa-solid fa-circle-question' },
  { href: '/dashboard/support', label: 'Suporte', icon: 'fa-solid fa-headset' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Plataforma', icon: 'fa-solid fa-gauge-high' },
  { href: '/admin/tenants', label: 'Tenants', icon: 'fa-solid fa-building' },
  { href: '/admin/bots', label: 'Bots (global)', icon: 'fa-solid fa-robot' },
  { href: '/admin/health', label: 'Saúde do sistema', icon: 'fa-solid fa-heart-pulse' },
  { href: '/admin/growth', label: 'Crescimento', icon: 'fa-solid fa-arrow-trend-up' },
  { href: '/admin/plans', label: 'Planos & Cupões', icon: 'fa-solid fa-tags' },
  { href: '/admin/billing', label: 'Pagamentos', icon: 'fa-solid fa-file-invoice-dollar' },
  { href: '/admin/reports', label: 'Relatórios', icon: 'fa-solid fa-chart-line' },
  { href: '/admin/revenue', label: 'Receita', icon: 'fa-solid fa-sack-dollar' },
  { href: '/admin/settings', label: 'Definições & API', icon: 'fa-solid fa-sliders' },
  { href: '/admin/branding', label: 'Marca & Landing', icon: 'fa-solid fa-palette' },
  { href: '/admin/support', label: 'Suporte', icon: 'fa-solid fa-headset' },
  { href: '/admin/logs', label: 'Logs & Auditoria', icon: 'fa-solid fa-clipboard-list' },
  { href: '/admin/broadcast', label: 'Comunicados', icon: 'fa-solid fa-bullhorn' },
];
