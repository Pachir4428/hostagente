import type { NavItem } from '@/components/AppShell';

export const TENANT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Resumo', icon: '◈' },
  { href: '/dashboard/transactions', label: 'Vendas', icon: '↹' },
  { href: '/dashboard/products', label: 'Pacotes', icon: '▤' },
  { href: '/dashboard/account', label: 'Conta & API', icon: '⚙' },
  { href: '/dashboard/subscription', label: 'Assinatura', icon: '★' },
  { href: '/dashboard/notifications', label: 'Notificações', icon: '⚑' },
  { href: '/dashboard/team', label: 'Equipa', icon: '👥' },
  { href: '/dashboard/support', label: 'Suporte', icon: '?' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Plataforma', icon: '◈' },
  { href: '/admin/tenants', label: 'Tenants', icon: '☷' },
  { href: '/admin/plans', label: 'Planos & Cupões', icon: '▤' },
  { href: '/admin/reports', label: 'Relatórios', icon: '↗' },
  { href: '/admin/support', label: 'Suporte', icon: '?' },
  { href: '/admin/logs', label: 'Logs & Auditoria', icon: '⧉' },
  { href: '/admin/broadcast', label: 'Comunicados', icon: '📣' },
];
