import type { NavItem } from '@/components/AppShell';

export const TENANT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Resumo', icon: 'fa-solid fa-gauge-high' },
  { href: '/dashboard/transactions', label: 'Vendas', icon: 'fa-solid fa-arrow-right-arrow-left' },
  { href: '/dashboard/bots', label: 'Bots', icon: 'fa-solid fa-robot' },
  { href: '/dashboard/products', label: 'Pacotes', icon: 'fa-solid fa-box' },
  { href: '/dashboard/account', label: 'Conta & API', icon: 'fa-solid fa-gear' },
  { href: '/dashboard/subscription', label: 'Assinatura', icon: 'fa-solid fa-star' },
  { href: '/dashboard/notifications', label: 'Notificações', icon: 'fa-solid fa-bell' },
  { href: '/dashboard/team', label: 'Equipa', icon: 'fa-solid fa-users' },
  { href: '/dashboard/support', label: 'Suporte', icon: 'fa-solid fa-headset' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Plataforma', icon: 'fa-solid fa-gauge-high' },
  { href: '/admin/tenants', label: 'Tenants', icon: 'fa-solid fa-building' },
  { href: '/admin/plans', label: 'Planos & Cupões', icon: 'fa-solid fa-tags' },
  { href: '/admin/billing', label: 'Pagamentos', icon: 'fa-solid fa-file-invoice-dollar' },
  { href: '/admin/reports', label: 'Relatórios', icon: 'fa-solid fa-chart-line' },
  { href: '/admin/settings', label: 'Definições & API', icon: 'fa-solid fa-sliders' },
  { href: '/admin/branding', label: 'Marca & Landing', icon: 'fa-solid fa-palette' },
  { href: '/admin/support', label: 'Suporte', icon: 'fa-solid fa-headset' },
  { href: '/admin/logs', label: 'Logs & Auditoria', icon: 'fa-solid fa-clipboard-list' },
  { href: '/admin/broadcast', label: 'Comunicados', icon: 'fa-solid fa-bullhorn' },
];
