export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg';
  const text = size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className={`grid place-items-center rounded-xl bg-teal font-display font-bold text-teal-ink ${box}`}
      >
        H
      </span>
      <span className={`font-display font-bold tracking-tight ${text}`}>
        Host<span className="text-teal">Agente</span>
      </span>
    </span>
  );
}
