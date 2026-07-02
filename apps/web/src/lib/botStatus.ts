// Shared visual language for bot statuses, matching the HostAgente design.
export interface BotStatusStyle {
  label: string;
  dot: string; // tailwind bg-* for the status dot
  chip: string; // tailwind classes for the status chip
}

export const BOT_STATUS: Record<string, BotStatusStyle> = {
  running: {
    label: 'Ativo',
    dot: 'bg-teal',
    chip: 'bg-teal/10 text-teal border border-teal/25',
  },
  waiting_qr: {
    label: 'A aguardar QR',
    dot: 'bg-gold',
    chip: 'bg-gold/10 text-gold border border-gold/25',
  },
  starting: {
    label: 'A iniciar',
    dot: 'bg-gold',
    chip: 'bg-gold/10 text-gold border border-gold/25',
  },
  stopping: {
    label: 'A parar',
    dot: 'bg-gold',
    chip: 'bg-gold/10 text-gold border border-gold/25',
  },
  stopped: {
    label: 'Parado',
    dot: 'bg-muted2',
    chip: 'bg-white/[0.05] text-muted border border-line',
  },
  error: {
    label: 'Erro',
    dot: 'bg-danger',
    chip: 'bg-danger/10 text-danger border border-danger/25',
  },
};

export function botStatus(status: string): BotStatusStyle {
  return (
    BOT_STATUS[status] || {
      label: status,
      dot: 'bg-muted2',
      chip: 'bg-white/[0.05] text-muted border border-line',
    }
  );
}
