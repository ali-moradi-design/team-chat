import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'accent';
};

export function Badge({ className, tone = 'neutral', ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-elevated text-muted border border-border',
        tone === 'success' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
        tone === 'warn' && 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
        tone === 'danger' && 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
        tone === 'accent' && 'bg-accent/15 text-accent-fg border border-accent/25',
        className,
      )}
      {...props}
    />
  );
}
