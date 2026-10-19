import { create } from 'zustand';
import type {
  Ack,
  Attachment,
  HistoryResponse,
  Message,
  Reaction,
  ThreadResponse,
} from '@team-chat/shared';
import { LIMITS } from '@team-chat/shared';
import { api } from '@/shared/api/http';
import { clientId } from '@/shared/lib/id';
import { getSocket } from '@/shared/socket/client';
import { mergeAscending } from './list';

export interface PendingMessage {
  clientMsgId: string;
  conversationId: string;
  authorId: string;
  text: string;
  attachments: Attachment[];
  threadRootId?: string;
  status: 'sending' | 'failed';
  createdAt: number;
  error?: string;
}

export interface Timeline {
  ids: string[];
  byId: Record<string, Message>;
  pending: PendingMessage[];
  hasMoreOlder: boolean;
  /** True while viewing history around a jump target: newer messages exist on the server. */
  hasMoreNewer: boolean;
  status: 'loading' | 'ready' | 'error';
  loadingOlder: boolean;
  touched: number;
}

export interface Thread {
  root: Message | null;
  replies: Message[];
  pending: PendingMessage[];
  status: 'loading' | 'ready' | 'error';
}

const MAX_TIMELINES = 10;
const emptyTimeline = (): Timeline => ({
  ids: [],
  byId: {},
  pending: [],
  hasMoreOlder: false,
  hasMoreNewer: false,
  status: 'loading',
  loadingOlder: false,
  touched: Date.now(),
});

interface MessagesState {
  timelines: Record<string, Timeline>;
  threads: Record<string, Thread>;

  openConversation: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string) => Promise<void>;
  loadNewer: (conversationId: string) => Promise<void>;
  jumpTo: (conversationId: string, messageId: string) => Promise<void>;
  jumpToLatest: (conversationId: string) => Promise<void>;
  openThread: (rootId: string) => Promise<void>;

  receive: (m: Message) => void;
  update: (m: Message) => void;
  setReactions: (conversationId: string, messageId: string, reactions: Reaction[]) => void;
  setThreadStats: (
    conversationId: string,
    rootId: string,
    replyCount: number,
    lastReplyAt: string,
  ) => void;
  clear: () => void;
}

const patchTimeline = (
  s: MessagesState,
  id: string,
  fn: (t: Timeline) => Timeline,
): Partial<MessagesState> => {
  const cur = s.timelines[id];
  return cur ? { timelines: { ...s.timelines, [id]: fn(cur) } } : s;
};

function evict(timelines: Record<string, Timeline>, keep: string): Record<string, Timeline> {
  const keys = Object.keys(timelines);
  if (keys.length <= MAX_TIMELINES) return timelines;
  const victims = keys
    .filter((k) => k !== keep)
    .sort((a, b) => timelines[a]!.touched - timelines[b]!.touched)
    .slice(0, keys.length - MAX_TIMELINES);
  const next = { ...timelines };
  for (const v of victims) delete next[v];
  return next;
}

export const useMessages = create<MessagesState>((set, get) => ({
  timelines: {},
  threads: {},

  async openConversation(conversationId) {
    const existing = get().timelines[conversationId];
    if (existing && existing.status === 'ready' && !existing.hasMoreNewer) {
      set((s) => patchTimeline(s, conversationId, (t) => ({ ...t, touched: Date.now() })));
      // Instant render from cache; catch up on anything missed in the background.
      await catchUp(conversationId);
      return;
    }
    set((s) => ({
      timelines: evict(
        {
          ...s.timelines,
          [conversationId]: {
            ...(existing ?? emptyTimeline()),
            status: existing?.ids.length ? 'ready' : 'loading',
            touched: Date.now(),
          },
        },
        conversationId,
      ),
    }));
    try {
      const page = await fetchPage(conversationId, `limit=${LIMITS.historyPageSize}`);
      set((s) =>
        patchTimeline(s, conversationId, (t) => {
          // Keep anything that arrived over the socket while the request was in flight.
          const base = existing?.hasMoreNewer
            ? { ids: [], byId: {} }
            : { ids: t.ids, byId: t.byId };
          const merged = mergeAscending(base.ids, base.byId, page.messages);
          return {
            ...t,
            ...merged,
            hasMoreOlder: page.hasMoreOlder,
            hasMoreNewer: false,
            status: 'ready',
          };
        }),
      );
    } catch {
      set((s) =>
        patchTimeline(s, conversationId, (t) => ({
          ...t,
          status: t.ids.length ? 'ready' : 'error',
        })),
      );
    }
  },

  async loadOlder(conversationId) {
    const t = get().timelines[conversationId];
    if (!t || t.loadingOlder || !t.hasMoreOlder || t.ids.length === 0) return;
    set((s) => patchTimeline(s, conversationId, (x) => ({ ...x, loadingOlder: true })));
    try {
      const page = await fetchPage(
        conversationId,
        `limit=${LIMITS.historyPageSize}&beforeId=${t.ids[0]}`,
      );
      set((s) =>
        patchTimeline(s, conversationId, (x) => ({
          ...x,
          ...mergeAscending(x.ids, x.byId, page.messages),
          hasMoreOlder: page.hasMoreOlder,
          loadingOlder: false,
        })),
      );
    } catch {
      set((s) => patchTimeline(s, conversationId, (x) => ({ ...x, loadingOlder: false })));
    }
  },

  async loadNewer(conversationId) {
    const t = get().timelines[conversationId];
    const last = t?.ids[t.ids.length - 1];
    if (!t || !t.hasMoreNewer || !last) return;
    try {
      const page = await fetchPage(
        conversationId,
        `limit=${LIMITS.historyPageSize}&afterId=${last}`,
      );
      set((s) =>
        patchTimeline(s, conversationId, (x) => ({
          ...x,
          ...mergeAscending(x.ids, x.byId, page.messages),
          hasMoreNewer: page.hasMoreNewer,
        })),
      );
    } catch {
      /* retried on the next scroll */
    }
  },

  async jumpTo(conversationId, messageId) {
    const t = get().timelines[conversationId];
    if (t?.byId[messageId]) return;
    set((s) => ({
      timelines: {
        ...s.timelines,
        [conversationId]: { ...emptyTimeline(), pending: t?.pending ?? [] },
      },
    }));
    const page = await fetchPage(
      conversationId,
      `limit=${LIMITS.historyPageSize}&aroundId=${messageId}`,
    );
    set((s) =>
      patchTimeline(s, conversationId, (x) => ({
        ...x,
        ...mergeAscending([], {}, page.messages),
        hasMoreOlder: page.hasMoreOlder,
        hasMoreNewer: page.hasMoreNewer,
        status: 'ready',
      })),
    );
  },

  async jumpToLatest(conversationId) {
    set((s) => {
      const cur = s.timelines[conversationId];
      return cur
        ? {
            timelines: {
              ...s.timelines,
              [conversationId]: { ...emptyTimeline(), pending: cur.pending },
            },
          }
        : s;
    });
    await get().openConversation(conversationId);
  },

  async openThread(rootId) {
    set((s) => ({
      threads: {
        ...s.threads,
        [rootId]: {
          root: s.threads[rootId]?.root ?? null,
          replies: s.threads[rootId]?.replies ?? [],
          pending: s.threads[rootId]?.pending ?? [],
          status: s.threads[rootId]?.root ? 'ready' : 'loading',
        },
      },
    }));
    try {
      const res = await api<ThreadResponse>(`/api/messages/${rootId}/thread`);
      set((s) => ({
        threads: {
          ...s.threads,
          [rootId]: {
            root: res.root,
            replies: res.replies,
            pending: s.threads[rootId]?.pending ?? [],
            status: 'ready',
          },
        },
      }));
    } catch {
      set((s) => ({
        threads: {
          ...s.threads,
          [rootId]: {
            ...(s.threads[rootId] ?? { root: null, replies: [], pending: [] }),
            status: 'error',
          },
        },
      }));
    }
  },

  receive(m) {
    set((s) => {
      if (m.threadRootId) {
        const th = s.threads[m.threadRootId];
        if (!th || th.replies.some((r) => r.id === m.id)) return s;
        const replies = [...th.replies, m].sort((a, b) => (a.id < b.id ? -1 : 1));
        return {
          threads: {
            ...s.threads,
            [m.threadRootId]: {
              ...th,
              replies,
              pending: th.pending.filter((p) => p.clientMsgId !== m.clientMsgId),
            },
          },
        };
      }
      const t = s.timelines[m.conversationId];
      if (!t) return s;
      const pending = m.clientMsgId
        ? t.pending.filter((p) => p.clientMsgId !== m.clientMsgId)
        : t.pending;
      if (t.hasMoreNewer)
        return { timelines: { ...s.timelines, [m.conversationId]: { ...t, pending } } };
      return {
        timelines: {
          ...s.timelines,
          [m.conversationId]: { ...t, ...mergeAscending(t.ids, t.byId, [m]), pending },
        },
      };
    });
  },

  update(m) {
    set((s) => {
      const next: Partial<MessagesState> = {};
      const t = s.timelines[m.conversationId];
      if (t?.byId[m.id])
        next.timelines = {
          ...s.timelines,
          [m.conversationId]: { ...t, byId: { ...t.byId, [m.id]: m } },
        };
      if (m.threadRootId) {
        const th = s.threads[m.threadRootId];
        if (th)
          next.threads = {
            ...s.threads,
            [m.threadRootId]: { ...th, replies: th.replies.map((r) => (r.id === m.id ? m : r)) },
          };
      } else if (s.threads[m.id]) {
        next.threads = { ...s.threads, [m.id]: { ...s.threads[m.id]!, root: m } };
      }
      return next;
    });
  },

  setReactions(conversationId, messageId, reactions) {
    set((s) => {
      const next: Partial<MessagesState> = {};
      const t = s.timelines[conversationId];
      const m = t?.byId[messageId];
      if (t && m)
        next.timelines = {
          ...s.timelines,
          [conversationId]: { ...t, byId: { ...t.byId, [messageId]: { ...m, reactions } } },
        };
      const threads = { ...s.threads };
      let changed = false;
      for (const [rootId, th] of Object.entries(s.threads)) {
        if (th.root?.id === messageId) {
          threads[rootId] = { ...th, root: { ...th.root, reactions } };
          changed = true;
        } else if (th.replies.some((r) => r.id === messageId)) {
          threads[rootId] = {
            ...th,
            replies: th.replies.map((r) => (r.id === messageId ? { ...r, reactions } : r)),
          };
          changed = true;
        }
      }
      if (changed) next.threads = threads;
      return next;
    });
  },

  setThreadStats(conversationId, rootId, replyCount, lastReplyAt) {
    set((s) => {
      const next: Partial<MessagesState> = {};
      const t = s.timelines[conversationId];
      const m = t?.byId[rootId];
      if (t && m)
        next.timelines = {
          ...s.timelines,
          [conversationId]: {
            ...t,
            byId: { ...t.byId, [rootId]: { ...m, replyCount, lastReplyAt } },
          },
        };
      const th = s.threads[rootId];
      if (th?.root)
        next.threads = {
          ...s.threads,
          [rootId]: { ...th, root: { ...th.root, replyCount, lastReplyAt } },
        };
      return next;
    });
  },

  clear: () => set({ timelines: {}, threads: {} }),
}));

async function fetchPage(conversationId: string, query: string): Promise<HistoryResponse> {
  return api<HistoryResponse>(`/api/conversations/${conversationId}/messages?${query}`);
}

/** After a reconnect or when re-opening a cached conversation: fetch what was missed. */
export async function catchUp(conversationId: string): Promise<void> {
  const { timelines } = useMessages.getState();
  const t = timelines[conversationId];
  if (!t || t.status !== 'ready') return;
  const last = t.ids[t.ids.length - 1];
  if (!last) return useMessages.getState().jumpToLatest(conversationId);
  try {
    let cursor = last;
    for (let i = 0; i < 4; i++) {
      const page = await fetchPage(
        conversationId,
        `limit=${LIMITS.historyMaxPageSize}&afterId=${cursor}`,
      );
      if (page.messages.length === 0) return;
      useMessages.setState((s) =>
        patchTimeline(s, conversationId, (x) => ({
          ...x,
          ...mergeAscending(x.ids, x.byId, page.messages),
        })),
      );
      cursor = page.messages[page.messages.length - 1]!.id;
      if (!page.hasMoreNewer) return;
    }
    // Too far behind: drop the cache instead of rendering a gappy timeline.
    await useMessages.getState().jumpToLatest(conversationId);
  } catch {
    /* offline: the next reconnect retries */
  }
}

// ---- sending --------------------------------------------------------------------------------------

const ACK_TIMEOUT_MS = 10_000;

function addPending(p: PendingMessage): void {
  useMessages.setState((s) => {
    if (p.threadRootId) {
      const th = s.threads[p.threadRootId];
      if (!th) return s;
      return {
        threads: {
          ...s.threads,
          [p.threadRootId]: {
            ...th,
            pending: [...th.pending.filter((x) => x.clientMsgId !== p.clientMsgId), p],
          },
        },
      };
    }
    const t = s.timelines[p.conversationId];
    if (!t) return s;
    return {
      timelines: {
        ...s.timelines,
        [p.conversationId]: {
          ...t,
          pending: [...t.pending.filter((x) => x.clientMsgId !== p.clientMsgId), p],
        },
      },
    };
  });
}

function setPendingStatus(p: PendingMessage, status: 'sending' | 'failed', error?: string): void {
  addPending({ ...p, status, ...(error ? { error } : {}) });
}

function removePending(p: PendingMessage): void {
  useMessages.setState((s) => {
    if (p.threadRootId) {
      const th = s.threads[p.threadRootId];
      return th
        ? {
            threads: {
              ...s.threads,
              [p.threadRootId]: {
                ...th,
                pending: th.pending.filter((x) => x.clientMsgId !== p.clientMsgId),
              },
            },
          }
        : s;
    }
    const t = s.timelines[p.conversationId];
    return t
      ? {
          timelines: {
            ...s.timelines,
            [p.conversationId]: {
              ...t,
              pending: t.pending.filter((x) => x.clientMsgId !== p.clientMsgId),
            },
          },
        }
      : s;
  });
}

function transmit(p: PendingMessage): void {
  const socket = getSocket();
  if (!socket) {
    setPendingStatus(p, 'failed', 'offline');
    return;
  }
  setPendingStatus(p, 'sending');
  socket.timeout(ACK_TIMEOUT_MS).emit(
    'message:send',
    {
      conversationId: p.conversationId,
      clientMsgId: p.clientMsgId,
      text: p.text,
      attachmentIds: p.attachments.map((a) => a.fileId),
      ...(p.threadRootId ? { threadRootId: p.threadRootId } : {}),
    },
    (err: Error | null, res?: Ack<{ message: Message }>) => {
      if (err || !res) return setPendingStatus(p, 'failed', 'timeout');
      if (!res.ok) return setPendingStatus(p, 'failed', res.error.message);
      removePending(p);
      useMessages.getState().receive(res.data.message);
    },
  );
}

export function sendMessage(input: {
  conversationId: string;
  authorId: string;
  text: string;
  attachments?: Attachment[];
  threadRootId?: string;
}): void {
  const p: PendingMessage = {
    clientMsgId: clientId(),
    conversationId: input.conversationId,
    authorId: input.authorId,
    text: input.text,
    attachments: input.attachments ?? [],
    ...(input.threadRootId ? { threadRootId: input.threadRootId } : {}),
    status: 'sending',
    createdAt: Date.now(),
  };
  addPending(p);
  transmit(p);
}

/** Retrying is safe: the server dedupes on clientMsgId. */
export function retryPending(p: PendingMessage): void {
  transmit(p);
}

export function discardPending(p: PendingMessage): void {
  removePending(p);
}

/** Re-sends everything that was still in flight when the connection dropped. */
export function flushPending(): void {
  const { timelines, threads } = useMessages.getState();
  const all = [
    ...Object.values(timelines).flatMap((t) => t.pending),
    ...Object.values(threads).flatMap((t) => t.pending),
  ];
  for (const p of all) transmit(p);
}

// ---- other mutations (optimistic where cheap) ---------------------------------------------------------

export function toggleReaction(m: Message, emoji: string, meId: string): void {
  const socket = getSocket();
  if (!socket) return;
  const store = useMessages.getState();
  // Optimistic toggle; the server's reaction:updated event is authoritative.
  const mine = m.reactions.find((r) => r.emoji === emoji)?.userIds.includes(meId);
  const optimistic: Reaction[] = mine
    ? m.reactions
        .map((r) =>
          r.emoji === emoji ? { ...r, userIds: r.userIds.filter((u) => u !== meId) } : r,
        )
        .filter((r) => r.userIds.length > 0)
    : m.reactions.some((r) => r.emoji === emoji)
      ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds: [...r.userIds, meId] } : r))
      : [...m.reactions, { emoji, userIds: [meId] }];
  store.setReactions(m.conversationId, m.id, optimistic);
  socket
    .timeout(ACK_TIMEOUT_MS)
    .emit(
      'reaction:toggle',
      { messageId: m.id, emoji },
      (err: Error | null, res?: Ack<{ reactions: Reaction[] }>) => {
        if (err || !res || !res.ok)
          store.setReactions(m.conversationId, m.id, m.reactions); // roll back
        else store.setReactions(m.conversationId, m.id, res.data.reactions);
      },
    );
}

export function emitAckAction<T>(
  event: 'message:edit' | 'message:delete' | 'message:pin',
  payload: Record<string, unknown>,
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const socket = getSocket();
    if (!socket)
      return resolve({ ok: false, error: { code: 'internal', message: 'offline' } } as Ack<T>);
    (
      socket.timeout(ACK_TIMEOUT_MS) as unknown as {
        emit: (e: string, p: unknown, cb: (err: Error | null, r?: Ack<T>) => void) => void;
      }
    ).emit(event, payload, (err, res) => {
      resolve(
        err || !res
          ? ({ ok: false, error: { code: 'internal', message: 'timeout' } } as Ack<T>)
          : res,
      );
    });
  });
}
