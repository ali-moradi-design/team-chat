import { memo } from 'react';
import { cn } from '../lib/cn';

export type PresenceDot = 'online' | 'away' | 'offline';

interface AvatarProps {
  name: string;
  hue: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  presence?: PresenceDot | undefined;
  isBot?: boolean;
  className?: string;
}

const sizes = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-[13px]',
  lg: 'size-14 text-xl',
};
const dots = { xs: 'size-2', sm: 'size-2.5', md: 'size-3', lg: 'size-4' };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = [...(parts[0] ?? '?')][0] ?? '?';
  const last = parts.length > 1 ? [...parts[parts.length - 1]!][0] : '';
  return (first + (last ?? '')).toUpperCase();
}

export const Avatar = memo(function Avatar({
  name,
  hue,
  size = 'md',
  presence,
  isBot,
  className,
}: AvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white',
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 42%), hsl(${(hue + 35) % 360} 75% 34%))`,
      }}
      aria-hidden="true"
    >
      {isBot ? '🤖' : initials(name)}
      {presence && (
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 rounded-full border-2 border-panel',
            dots[size],
            presence === 'online' && 'bg-success',
            presence === 'away' && 'bg-accent',
            presence === 'offline' && 'bg-faint',
          )}
        />
      )}
    </span>
  );
});
