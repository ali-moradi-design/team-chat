import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'icon';
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' &&
          'bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/20',
        variant === 'ghost' && 'bg-transparent text-muted hover:bg-elevated hover:text-foreground',
        variant === 'outline' &&
          'border border-border bg-transparent text-foreground hover:bg-elevated',
        variant === 'danger' && 'bg-danger/15 text-danger hover:bg-danger/25',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'icon' && 'h-10 w-10',
        className,
      )}
      {...props}
    />
  );
}
