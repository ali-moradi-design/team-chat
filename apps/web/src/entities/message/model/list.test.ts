import { describe, expect, it } from 'vitest';
import type { Message } from '@team-chat/shared';
import { buildItems, mergeAscending } from './list';

const msg = (id: string, authorId = 'a', at = '2026-03-01T10:00:00.000Z'): Message => ({
  id, conversationId: 'c', authorId, text: id, attachments: [], reactions: [], mentions: [], mentionsAll: false,
  replyCount: 0, pinned: false, createdAt: at,
});

describe('mergeAscending', () => {
  it('appends newer, inserts older in order and dedupes', () => {
    const base = mergeAscending([], {}, [msg('b'), msg('d')]);
    const merged = mergeAscending(base.ids, base.byId, [msg('c'), msg('a'), msg('d'), msg('e')]);
    expect(merged.ids).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(Object.keys(merged.byId)).toHaveLength(5);
  });

  it('replaces an existing message without duplicating its id', () => {
    const base = mergeAscending([], {}, [msg('a')]);
    const next = mergeAscending(base.ids, base.byId, [{ ...msg('a'), text: 'edited' }]);
    expect(next.ids).toEqual(['a']);
    expect(next.byId.a?.text).toBe('edited');
  });

  it('does not mutate its inputs', () => {
    const ids = ['a'];
    mergeAscending(ids, { a: msg('a') }, [msg('b')]);
    expect(ids).toEqual(['a']);
  });
});

describe('buildItems', () => {
  const byId = {
    a: msg('a', 'x', '2026-03-01T10:00:00.000Z'),
    b: msg('b', 'x', '2026-03-01T10:02:00.000Z'),
    c: msg('c', 'y', '2026-03-01T10:03:00.000Z'),
    d: msg('d', 'x', '2026-03-02T09:00:00.000Z'),
  };
  it('adds day separators and groups consecutive messages', () => {
    const items = buildItems({ ids: ['a', 'b', 'c', 'd'], byId, pending: [], dividerAfterId: undefined, meId: 'me' });
    expect(items.map((i) => (i.kind === 'message' ? `${i.id}${i.grouped ? '+' : ''}` : i.kind))).toEqual([
      'day', 'a', 'b+', 'c', 'day', 'd',
    ]);
  });

  it('places the unread divider before the first foreign message after the pointer', () => {
    const items = buildItems({ ids: ['a', 'b', 'c'], byId, pending: [], dividerAfterId: 'a', meId: 'me' });
    expect(items.map((i) => i.kind)).toEqual(['day', 'message', 'divider', 'message', 'message']);
  });

  it('skips the divider when only own messages are newer', () => {
    const items = buildItems({ ids: ['a', 'b'], byId, pending: [], dividerAfterId: 'a', meId: 'x' });
    expect(items.some((i) => i.kind === 'divider')).toBe(false);
  });
});
