import { Badge } from '@/shared/ui';
import { useChatStore } from '@/shared/lib/chat';

export function ConnectionPill() {
  const status = useChatStore((s) => s.connStatus);

  if (status === 'connected') {
    return (
      <Badge tone="success" aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Connected
      </Badge>
    );
  }
  if (status === 'reconnecting') {
    return (
      <Badge tone="warn" aria-live="polite">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Reconnecting
      </Badge>
    );
  }
  return (
    <Badge tone="danger" aria-live="polite">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
      Offline
    </Badge>
  );
}
