import type { Message } from '@team-chat/shared';

/** Ids are Mongo ObjectIds: lexicographic order == creation order. */
export function mergeAscending(
  ids: string[],
  byId: Record<string, Message>,
  incoming: Message[],
): { ids: string[]; byId: Record<string, Message> } {
  if (incoming.length === 0) return { ids, byId };
  const nextById = { ...byId };
  let nextIds = ids;
  let copied = false;
  const ensureCopy = () => {
    if (!copied) {
      nextIds = ids.slice();
      copied = true;
    }
  };
  for (const m of incoming) {
    const exists = m.id in nextById;
    nextById[m.id] = m;
    if (exists) continue;
    ensureCopy();
    const last = nextIds[nextIds.length - 1];
    if (last === undefined || m.id > last) {
      nextIds.push(m.id);
      continue;
    }
    // binary insert
    let lo = 0;
    let hi = nextIds.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (nextIds[mid]! < m.id) lo = mid + 1;
      else hi = mid;
    }
    nextIds.splice(lo, 0, m.id);
  }
  return { ids: nextIds, byId: nextById };
}

export type TimelineItem =
  | { kind: 'day'; key: string; date: string }
  | { kind: 'divider'; key: string }
  | { kind: 'message'; key: string; id: string; grouped: boolean }
  | { kind: 'pending'; key: string; clientMsgId: string; grouped: boolean };

const GROUP_WINDOW_MS = 5 * 60_000;

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export interface PendingLike {
  clientMsgId: string;
  createdAt: number;
}

/**
 * Flattens messages into render rows: day separators, the "new messages" divider and
 * grouping of consecutive messages by the same author (within 5 minutes).
 */
export function buildItems(opts: {
  ids: string[];
  byId: Record<string, Message>;
  pending: Array<PendingLike & { authorId: string }>;
  dividerAfterId: string | undefined;
  meId: string;
}): TimelineItem[] {
  const items: TimelineItem[] = [];
  let prevDay = '';
  let prevAuthor = '';
  let prevTime = 0;
  let dividerPlaced = false;

  for (const id of opts.ids) {
    const m = opts.byId[id];
    if (!m) continue;
    const day = dayKey(m.createdAt);
    const time = new Date(m.createdAt).getTime();
    if (day !== prevDay) {
      items.push({ kind: 'day', key: `day-${day}`, date: m.createdAt });
      prevDay = day;
      prevAuthor = '';
    }
    if (!dividerPlaced && opts.dividerAfterId && m.id > opts.dividerAfterId && m.authorId !== opts.meId) {
      items.push({ kind: 'divider', key: 'divider' });
      dividerPlaced = true;
      prevAuthor = '';
    }
    const grouped = prevAuthor === m.authorId && time - prevTime < GROUP_WINDOW_MS && !m.threadRootId;
    items.push({ kind: 'message', key: m.id, id: m.id, grouped });
    prevAuthor = m.authorId;
    prevTime = time;
  }

  for (const p of opts.pending) {
    const day = dayKey(new Date(p.createdAt).toISOString());
    if (day !== prevDay) {
      items.push({ kind: 'day', key: `day-${day}`, date: new Date(p.createdAt).toISOString() });
      prevDay = day;
      prevAuthor = '';
    }
    const grouped = prevAuthor === p.authorId && p.createdAt - prevTime < GROUP_WINDOW_MS;
    items.push({ kind: 'pending', key: `p-${p.clientMsgId}`, clientMsgId: p.clientMsgId, grouped });
    prevAuthor = p.authorId;
    prevTime = p.createdAt;
  }
  return items;
}
