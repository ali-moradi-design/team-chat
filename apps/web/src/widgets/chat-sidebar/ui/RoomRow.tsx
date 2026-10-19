import { memo } from 'react';
import { cn } from '@/shared/lib';

type Props = {
  id: string;
  name: string;
  count: number;
  active: boolean;
  onSelect: (id: string) => void;
};

function RoomRowComponent({ id, name, count, active, onSelect }: Props) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelect(id)}
        className={cn(
          'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          active
            ? 'bg-accent/15 text-foreground ring-1 ring-accent/20'
            : 'text-muted hover:bg-elevated hover:text-foreground',
        )}
      >
        <span className="truncate font-medium tracking-tight">
          <span className="mr-1 text-muted/80" aria-hidden>
            #
          </span>
          {name}
        </span>
        <span
          className={cn(
            'ml-2 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums',
            active ? 'bg-accent/25 text-accent-fg' : 'bg-surface text-muted',
          )}
          aria-label={`${count} online`}
        >
          {count}
        </span>
      </button>
    </li>
  );
}

export const RoomRow = memo(RoomRowComponent);
