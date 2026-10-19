import { useChatStore } from '@/shared/lib/chat';
import { Button } from '@/shared/ui';
import { getSocket } from '@/shared/lib/socket';

export function StatusBanners() {
  const connStatus = useChatStore((s) => s.connStatus);
  const lastError = useChatStore((s) => s.lastError);
  const setLastError = useChatStore((s) => s.setLastError);
  const rooms = useChatStore((s) => s.rooms);

  if (connStatus === 'connected' && !lastError && rooms.length > 0) return null;

  return (
    <div className="space-y-2 px-3 pt-3 md:px-8" role="status" aria-live="polite">
      {connStatus === 'offline' || connStatus === 'reconnecting' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <span>
            {connStatus === 'offline'
              ? 'You are offline. Messages will fail until reconnected.'
              : 'Reconnecting to the chat server…'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-500/30 text-amber-100"
            onClick={() => getSocket()?.connect()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {lastError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{lastError}</span>
          <Button variant="ghost" size="sm" onClick={() => setLastError(null)} aria-label="Dismiss error">
            Dismiss
          </Button>
        </div>
      ) : null}

      {connStatus === 'connected' && rooms.length === 0 ? (
        <div className="rounded-xl border border-border bg-elevated/60 px-3 py-2 text-sm text-muted">
          Loading rooms…
        </div>
      ) : null}
    </div>
  );
}
