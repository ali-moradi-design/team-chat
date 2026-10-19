import { create } from 'zustand';
import type { Conversation, ConversationSummary, Message } from '@team-chat/shared';
import { toPlainPreview } from '@team-chat/shared';

interface ConversationsState {
  byId: Record<string, ConversationSummary>;
  loaded: boolean;
  activeId: string | null;
  setAll: (list: ConversationSummary[]) => void;
  upsert: (c: ConversationSummary) => void;
  patchBase: (c: Conversation) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
  /** A new top-level message arrived. `viewing` = the user is looking at this conversation right now. */
  onMessage: (m: Message, meId: string, viewing: boolean) => void;
  markRead: (conversationId: string, messageId: string) => void;
  applyReadReceipt: (conversationId: string, userId: string, messageId: string) => void;
  setMuted: (conversationId: string, muted: boolean) => void;
}

const sortKey = (c: ConversationSummary) => c.lastMessageAt ?? c.createdAt;

export const useConversations = create<ConversationsState>((set) => ({
  byId: {},
  loaded: false,
  activeId: null,
  setAll: (list) => set({ byId: Object.fromEntries(list.map((c) => [c.id, c])), loaded: true }),
  upsert: (c) => set((s) => ({ byId: { ...s.byId, [c.id]: c } })),
  patchBase: (c) =>
    set((s) => {
      const cur = s.byId[c.id];
      return cur ? { byId: { ...s.byId, [c.id]: { ...cur, ...c } } } : s;
    }),
  remove: (id) =>
    set((s) => {
      const { [id]: _gone, ...rest } = s.byId;
      return { byId: rest, activeId: s.activeId === id ? null : s.activeId };
    }),
  setActive: (id) => set({ activeId: id }),
  onMessage: (m, meId, viewing) =>
    set((s) => {
      const cur = s.byId[m.conversationId];
      if (!cur || m.threadRootId) return s;
      const mine = m.authorId === meId;
      const mentioned = m.mentions.includes(meId) || m.mentionsAll;
      const counts = mine || viewing ? {} : { unreadCount: Math.min(cur.unreadCount + 1, 99), mentionCount: cur.mentionCount + (mentioned ? 1 : 0) };
      return {
        byId: {
          ...s.byId,
          [cur.id]: {
            ...cur,
            ...counts,
            lastMessageAt: m.createdAt,
            lastMessage: { id: m.id, authorId: m.authorId, text: toPlainPreview(m.text || m.attachments[0]?.name || '', 140), createdAt: m.createdAt },
            ...(mine || viewing ? { lastReadMessageId: m.id } : {}),
          },
        },
      };
    }),
  markRead: (conversationId, messageId) =>
    set((s) => {
      const cur = s.byId[conversationId];
      if (!cur) return s;
      if (cur.unreadCount === 0 && cur.mentionCount === 0 && cur.lastReadMessageId && cur.lastReadMessageId >= messageId) return s;
      return {
        byId: {
          ...s.byId,
          [conversationId]: {
            ...cur,
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: cur.lastReadMessageId && cur.lastReadMessageId > messageId ? cur.lastReadMessageId : messageId,
          },
        },
      };
    }),
  applyReadReceipt: (conversationId, userId, messageId) =>
    set((s) => {
      const cur = s.byId[conversationId];
      if (!cur) return s;
      const prev = cur.peerReads?.[userId];
      if (prev && prev >= messageId) return s;
      return { byId: { ...s.byId, [conversationId]: { ...cur, peerReads: { ...cur.peerReads, [userId]: messageId } } } };
    }),
  setMuted: (conversationId, muted) =>
    set((s) => {
      const cur = s.byId[conversationId];
      return cur ? { byId: { ...s.byId, [conversationId]: { ...cur, muted } } } : s;
    }),
}));

export const useConversation = (id: string | undefined): ConversationSummary | undefined =>
  useConversations((s) => (id ? s.byId[id] : undefined));

/** Channels: alphabetical. DMs: most recent first. */
export function groupConversations(byId: Record<string, ConversationSummary>): {
  channels: ConversationSummary[];
  dms: ConversationSummary[];
} {
  const all = Object.values(byId);
  const channels = all.filter((c) => c.type === 'channel').sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }));
  const dms = all.filter((c) => c.type === 'dm').sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return { channels, dms };
}

/** Title for the sidebar / header. DMs are named after the other participants. */
export function conversationTitle(
  c: Pick<ConversationSummary, 'type' | 'name' | 'members'>,
  meId: string,
  nameOf: (userId: string) => string,
  youLabel: string,
): string {
  if (c.type === 'channel') return c.name ?? '';
  const others = c.members.filter((m) => m.userId !== meId);
  if (others.length === 0) return `${nameOf(meId)} (${youLabel})`;
  return others.map((m) => nameOf(m.userId)).join(', ');
}

export const totalUnread = (byId: Record<string, ConversationSummary>): { unread: number; mentions: number } => {
  let unread = 0;
  let mentions = 0;
  for (const c of Object.values(byId)) {
    if (c.muted) continue;
    unread += c.unreadCount;
    mentions += c.mentionCount;
  }
  return { unread, mentions };
};
