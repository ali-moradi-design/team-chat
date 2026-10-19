import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ConversationSummary, User } from '@team-chat/shared';
import { conversationTitle, totalUnread, useConversations } from '@/entities/conversation';
import { catchUp, flushPending, useMessages } from '@/entities/message';
import { useSession } from '@/entities/session';
import { useUsers } from '@/entities/user';
import { notifyIncoming, useUnreadTitle } from '@/features/notifications';
import { useIdlePresence } from '@/features/presence';
import { useTyping } from '@/features/typing';
import { api, scheduleTokenRefresh } from '@/shared/api/http';
import { i18next } from '@/shared/i18n';
import { connectSocket, disconnectSocket, getSocket } from '@/shared/socket/client';

const isViewing = (conversationId: string) =>
  useConversations.getState().activeId === conversationId &&
  document.visibilityState === 'visible' &&
  document.hasFocus();

async function loadDirectory(): Promise<void> {
  const [{ users }, { conversations }] = await Promise.all([
    api<{ users: User[] }>('/api/users'),
    api<{ conversations: ConversationSummary[] }>('/api/conversations'),
  ]);
  useUsers.getState().setAll(users);
  useConversations.getState().setAll(conversations);
}

/** Connects the socket for the signed-in user and mirrors server events into the stores. */
export function useRealtime(): void {
  const meId = useSession((s) => s.me?.id);
  const qc = useQueryClient();
  const byId = useConversations((s) => s.byId);
  const { unread, mentions } = totalUnread(byId);
  useUnreadTitle(unread, mentions);
  useIdlePresence();

  useEffect(() => {
    if (!meId) return;
    const socket = connectSocket();
    const stopRefresh = scheduleTokenRefresh();
    let first = true;

    socket.on('ready', ({ presence }) => {
      useUsers.getState().setPresenceSnapshot(presence);
      if (first) {
        first = false;
        void loadDirectory().catch(() => toast.error(i18next.t('common.error')));
        return;
      }
      // Reconnect: refresh counters, fetch what was missed in the open conversation, resend unsent messages.
      void api<{ conversations: ConversationSummary[] }>('/api/conversations').then(
        ({ conversations }) => useConversations.getState().setAll(conversations),
      );
      const active = useConversations.getState().activeId;
      if (active) void catchUp(active);
      flushPending();
    });

    socket.on('message:new', ({ message }) => {
      useMessages.getState().receive(message);
      const convs = useConversations.getState();
      const conv = convs.byId[message.conversationId];
      if (!conv) {
        // Added to a conversation we have not heard about yet.
        void api<{ conversation: ConversationSummary }>(
          `/api/conversations/${message.conversationId}`,
        )
          .then((r) => convs.upsert(r.conversation))
          .catch(() => undefined);
        return;
      }
      const viewing = isViewing(message.conversationId);
      convs.onMessage(message, meId, viewing);
      if (message.authorId === meId) return;
      const users = useUsers.getState().byId;
      notifyIncoming(message, {
        authorName: users[message.authorId]?.name ?? i18next.t('common.unknownUser'),
        conversationTitle: `${conv.type === 'channel' ? '#' : ''}${conversationTitle(conv, meId, (id) => users[id]?.name ?? '', i18next.t('common.you'))}`,
        isDm: conv.type === 'dm',
        muted: conv.muted,
        viewing,
        mentioned: message.mentions.includes(meId) || message.mentionsAll,
        open: () =>
          window.dispatchEvent(
            new CustomEvent('tc:open-conversation', { detail: message.conversationId }),
          ),
      });
    });
    socket.on('message:updated', ({ message }) => {
      useMessages.getState().update(message);
      void qc.invalidateQueries({ queryKey: ['pins', message.conversationId] });
    });
    socket.on('reaction:updated', (p) =>
      useMessages.getState().setReactions(p.conversationId, p.messageId, p.reactions),
    );
    socket.on('thread:updated', (p) =>
      useMessages
        .getState()
        .setThreadStats(p.conversationId, p.rootId, p.replyCount, p.lastReplyAt),
    );
    socket.on('typing', (p) => useTyping.getState().set(p.conversationId, p.userId, p.isTyping));
    socket.on('presence:update', (p) => useUsers.getState().setPresence(p.userId, p.status));
    socket.on('user:upsert', ({ user }) => useUsers.getState().upsert(user));
    socket.on('read:updated', (p) => {
      if (p.userId === meId) useConversations.getState().markRead(p.conversationId, p.messageId);
      else useConversations.getState().applyReadReceipt(p.conversationId, p.userId, p.messageId);
    });
    socket.on('conversation:upsert', ({ conversation }) =>
      useConversations.getState().upsert(conversation),
    );
    socket.on('conversation:updated', ({ conversation }) =>
      useConversations.getState().patchBase(conversation),
    );
    socket.on('conversation:removed', ({ conversationId }) =>
      useConversations.getState().remove(conversationId),
    );

    return () => {
      stopRefresh();
      disconnectSocket();
      useMessages.getState().clear();
    };
  }, [meId, qc]);

  // Keep a reference so the socket module is not tree-shaken in tests.
  void getSocket;
}
