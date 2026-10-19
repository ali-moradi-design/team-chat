import { useEffect, useRef } from 'react';
import { useConversations } from '@/entities/conversation';
import { getSocket } from '@/shared/socket/client';

/**
 * Marks the newest loaded message as read once the user is really looking at the bottom of the
 * conversation (tab visible and focused). Debounced so scroll jitter does not spam the server.
 */
export function useMarkRead(conversationId: string, newestId: string | undefined, atBottom: boolean, positioned: boolean): void {
  const lastSent = useRef<string>('');

  useEffect(() => {
    lastSent.current = '';
  }, [conversationId]);

  useEffect(() => {
    if (!newestId || !atBottom || !positioned) return;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const conv = useConversations.getState().byId[conversationId];
      if (!conv) return;
      const behind = conv.unreadCount > 0 || conv.mentionCount > 0 || !conv.lastReadMessageId || conv.lastReadMessageId < newestId;
      if (!behind || lastSent.current === newestId) return;
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      lastSent.current = newestId;
      useConversations.getState().markRead(conversationId, newestId);
      getSocket()?.emit('read:update', { conversationId, messageId: newestId });
    };
    timer = setTimeout(attempt, 350);
    const onFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(attempt, 150);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [conversationId, newestId, atBottom, positioned]);
}
