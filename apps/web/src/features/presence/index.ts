import { useEffect } from 'react';
import { getSocket } from '@/shared/socket/client';

const IDLE_MS = 5 * 60_000;

/** Reports "away" after 5 minutes without input or while the tab is hidden for a while. */
export function useIdlePresence(): void {
  useEffect(() => {
    let status: 'online' | 'away' = 'online';
    let idleTimer: ReturnType<typeof setTimeout>;
    let hiddenTimer: ReturnType<typeof setTimeout>;
    const set = (next: 'online' | 'away') => {
      if (next === status) return;
      status = next;
      getSocket()?.emit('presence:set', { status: next });
    };
    const active = () => {
      set('online');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => set('away'), IDLE_MS);
    };
    const onVisibility = () => {
      clearTimeout(hiddenTimer);
      if (document.visibilityState === 'visible') active();
      else hiddenTimer = setTimeout(() => set('away'), 60_000);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    // After a reconnect the server starts us as "online" again.
    const socket = getSocket();
    const onConnect = () => {
      if (status === 'away') getSocket()?.emit('presence:set', { status: 'away' });
    };
    socket?.on('connect', onConnect);
    active();
    return () => {
      events.forEach((e) => window.removeEventListener(e, active));
      document.removeEventListener('visibilitychange', onVisibility);
      socket?.off('connect', onConnect);
      clearTimeout(idleTimer);
      clearTimeout(hiddenTimer);
    };
  }, []);
}
