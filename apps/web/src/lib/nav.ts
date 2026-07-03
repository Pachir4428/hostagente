import type { NavItem } from '@/components/AppShell';

export const TENANT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Resumo', icon: '◈' },
  { href: '/dashboard/transactions', label: 'Vendas', icon: '↹' },
  { href: '/dashboard/products', label: 'Pacotes', icon: '▤' },
  { href: '/dashboard/account', label: 'Conta & API', icon: '⚙' },
  { href: '/dashboard/subscription', label: 'Assinatura', icon: '★', soon: true },
  { href: '/dashboard/notifications', label: 'Notificações', icon: '⚑', soon: true },
  { href: '/dashboard/team', label: 'Equipa', icon: '👥', soon: true },
  { href: '/dashboard/support', label: 'Suporte', icon: '?', soon: true },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Plataforma', icon: '◈' },
  { href: '/admin/tenants', label: 'Tenants', icon: '☷' },
  { href: '/admin/plans', label: 'Planos & Preços', icon: '▤', soon: true },
  { href: '/admin/billing', label: 'Financeiro', icon: '$', soon: true },
  { href: '/admin/reports', label: 'Relatórios', icon: '↗', soon: true },
  { href: '/admin/support', label: 'Suporte', icon: '?', soon: true },
  { href: '/admin/logs', label: 'Logs & Auditoria', icon: '⧉', soon: true },
  { href: '/admin/broadcast', label: 'Comunicados', icon: '📣', soon: true },
];
