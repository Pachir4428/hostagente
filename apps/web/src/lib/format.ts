export function mzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    value ?? 0,
  ) + ' MZN';
}

export function dateTime(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TX_STATUS: Record<string, { label: string; chip: string }> = {
  delivered: { label: 'Entregue', chip: 'bg-teal/10 text-teal border border-teal/25' },
  refused: { label: 'Recusado', chip: 'bg-danger/10 text-danger border border-danger/25' },
  duplicate: { label: 'Duplicado', chip: 'bg-gold/10 text-gold border border-gold/25' },
  pending: { label: 'Pendente', chip: 'bg-hover text-muted border border-line' },
};

export const OPERATOR_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
  mkesh: 'mKesh',
};
