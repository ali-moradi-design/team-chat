import { cn } from '../lib/cn';

export function CountBadge({ count, mention, className }: { count: number; mention?: boolean; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5',
        mention ? 'bg-accent text-accent-fg' : 'bg-primary text-primary-fg',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
