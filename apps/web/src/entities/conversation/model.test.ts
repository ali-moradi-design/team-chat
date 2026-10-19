import { beforeEach, describe, expect, it } from 'vitest';
import type { ConversationSummary, Message } from '@team-chat/shared';
import { groupConversations, totalUnread, useConversations } from './model';

const conv = (id: string, over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id,
  type: 'channel',
  name: id,
  isPrivate: false,
  members: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  unreadCount: 0,
  mentionCount: 0,
  muted: false,
  ...over,
});
const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id,
  conversationId: 'c1',
  authorId: 'other',
  text: 'hi',
  attachments: [],
  reactions: [],
  mentions: [],
  mentionsAll: false,
  replyCount: 0,
  pinned: false,
  createdAt: '2026-03-01T10:00:00.000Z',
  ...over,
});

beforeEach(() =>
  useConversations.setState({ byId: { c1: conv('c1') }, loaded: true, activeId: null }),
);

describe('conversation store', () => {
  it('counts unread and mentions for messages from others while not viewing', () => {
    const s = useConversations.getState();
    s.onMessage(msg('a'), 'me', false);
    s.onMessage(msg('b', { mentions: ['me'] }), 'me', false);
    expect(useConversations.getState().byId.c1).toMatchObject({ unreadCount: 2, mentionCount: 1 });
  });

  it('does not count own messages, thread replies, or messages in the open conversation', () => {
    const s = useConversations.getState();
    s.onMessage(msg('a', { authorId: 'me' }), 'me', false);
    s.onMessage(msg('b', { threadRootId: 'x' }), 'me', false);
    s.onMessage(msg('c'), 'me', true);
    expect(useConversations.getState().byId.c1?.unreadCount).toBe(0);
  });

  it('a stale read receipt does not wipe newer unread messages', () => {
    const s = useConversations.getState();
    s.onMessage(msg('b'), 'me', false);
    s.markRead('c1', 'a'); // older than the latest message
    expect(useConversations.getState().byId.c1?.unreadCount).toBe(1);
    s.markRead('c1', 'b');
    expect(useConversations.getState().byId.c1?.unreadCount).toBe(0);
  });

  it('never moves the read pointer backwards', () => {
    const s = useConversations.getState();
    s.markRead('c1', 'z');
    s.markRead('c1', 'a');
    expect(useConversations.getState().byId.c1?.lastReadMessageId).toBe('z');
  });

  it('groups channels alphabetically and DMs by recency; muted conversations do not count', () => {
    const byId = {
      b: conv('b', { name: 'beta', unreadCount: 2 }),
      a: conv('a', { name: 'alpha', unreadCount: 1, muted: true }),
      d1: conv('d1', { type: 'dm', lastMessageAt: '2026-02-01T00:00:00.000Z' }),
      d2: conv('d2', { type: 'dm', lastMessageAt: '2026-03-01T00:00:00.000Z' }),
    };
    const g = groupConversations(byId);
    expect(g.channels.map((c) => c.id)).toEqual(['a', 'b']);
    expect(g.dms.map((c) => c.id)).toEqual(['d2', 'd1']);
    expect(totalUnread(byId)).toEqual({ unread: 2, mentions: 0 });
  });
});
