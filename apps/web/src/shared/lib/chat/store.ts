import { create } from 'zustand';
import type {
  ChatMessage,
  ChatRoom,
  ConnStatus,
  PresenceUser,
} from '@/shared/lib/socket';

type TypingMap = Record<string, Record<string, { displayName: string; at: number }>>;

type ChatState = {
  userId: string | null;
  displayName: string | null;
  connStatus: ConnStatus;
  rooms: ChatRoom[];
  activeRoomId: string;
  /** Rooms this client has joined (for reconnect re-join) */
  joinedRoomIds: string[];
  messagesByRoom: Record<string, ChatMessage[]>;
  presenceByRoom: Record<string, PresenceUser[]>;
  typingByRoom: TypingMap;
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  lastError: string | null;

  setAuth: (userId: string, displayName: string) => void;
  setConnStatus: (s: ConnStatus) => void;
  setRooms: (rooms: ChatRoom[]) => void;
  setActiveRoom: (roomId: string) => void;
  markJoined: (roomId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setLastError: (error: string | null) => void;

  upsertMessages: (
    roomId: string,
    messages: ChatMessage[],
    mode?: 'replace' | 'append' | 'prepend',
  ) => void;
  addOptimistic: (message: ChatMessage) => void;
  reconcileAck: (
    clientMsgId: string,
    patch: Partial<ChatMessage> & { status?: ChatMessage['status'] },
  ) => void;
  markFailed: (clientMsgId: string) => void;
  applyIncoming: (message: ChatMessage) => void;
  getPendingMessages: () => ChatMessage[];

  setPresence: (roomId: string, users: PresenceUser[]) => void;
  setTyping: (roomId: string, userId: string, displayName: string, typing: boolean) => void;
};

function dedupeMessages(list: ChatMessage[]): ChatMessage[] {
  const byKey = new Map<string, ChatMessage>();

  for (const m of list) {
    const key = m.clientMsgId || m.id;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    // Prefer server-confirmed over pending/failed; prefer newer createdAt
    const prevRank = prev.status === 'pending' ? 0 : prev.status === 'failed' ? 1 : 2;
    const nextRank = m.status === 'pending' ? 0 : m.status === 'failed' ? 1 : 2;
    if (nextRank > prevRank) {
      byKey.set(key, m);
    } else if (nextRank === prevRank) {
      byKey.set(
        key,
        new Date(m.createdAt).getTime() >= new Date(prev.createdAt).getTime() ? m : prev,
      );
    }
  }

  // Also collapse if same server id under different client keys (rare)
  const byServerId = new Map<string, ChatMessage>();
  for (const m of byKey.values()) {
    if (m.status === 'pending' || m.status === 'failed') {
      byServerId.set(`local:${m.clientMsgId}`, m);
      continue;
    }
    const existing = byServerId.get(m.id);
    if (!existing) byServerId.set(m.id, m);
  }

  return [...byServerId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export const useChatStore = create<ChatState>((set, get) => ({
  userId: null,
  displayName: null,
  connStatus: 'offline',
  rooms: [],
  activeRoomId: 'general',
  joinedRoomIds: ['general'],
  messagesByRoom: {},
  presenceByRoom: {},
  typingByRoom: {},
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  theme: 'dark',
  lastError: null,

  setAuth: (userId, displayName) => set({ userId, displayName }),
  setConnStatus: (connStatus) => set({ connStatus }),
  setRooms: (rooms) => set({ rooms }),
  setActiveRoom: (activeRoomId) => set({ activeRoomId }),
  markJoined: (roomId) =>
    set((s) =>
      s.joinedRoomIds.includes(roomId)
        ? s
        : { joinedRoomIds: [...s.joinedRoomIds, roomId] },
    ),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
      localStorage.setItem('chatTheme', theme);
      return { theme };
    }),
  setLastError: (lastError) => set({ lastError }),

  upsertMessages: (roomId, messages, mode = 'replace') => {
    set((s) => {
      const prev = s.messagesByRoom[roomId] ?? [];
      let next: ChatMessage[];
      if (mode === 'replace') {
        // Keep local pending/failed that aren't in the server snapshot
        const serverClientIds = new Set(messages.map((m) => m.clientMsgId));
        const locals = prev.filter(
          (m) =>
            (m.status === 'pending' || m.status === 'failed') &&
            !serverClientIds.has(m.clientMsgId),
        );
        next = [...messages.map((m) => ({ ...m, status: 'sent' as const })), ...locals];
      } else if (mode === 'append') next = [...prev, ...messages];
      else next = [...messages, ...prev];
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: dedupeMessages(next),
        },
      };
    });
  },

  addOptimistic: (message) => {
    const roomId = message.roomId;
    set((s) => ({
      messagesByRoom: {
        ...s.messagesByRoom,
        [roomId]: dedupeMessages([...(s.messagesByRoom[roomId] ?? []), message]),
      },
    }));
  },

  reconcileAck: (clientMsgId, patch) => {
    set((s) => {
      const nextRooms: Record<string, ChatMessage[]> = {};
      for (const [roomId, list] of Object.entries(s.messagesByRoom)) {
        nextRooms[roomId] = dedupeMessages(
          list.map((m) =>
            m.clientMsgId === clientMsgId
              ? { ...m, ...patch, status: patch.status ?? 'sent' }
              : m,
          ),
        );
      }
      return { messagesByRoom: nextRooms };
    });
  },

  markFailed: (clientMsgId) => {
    get().reconcileAck(clientMsgId, { status: 'failed' });
  },

  applyIncoming: (message) => {
    const roomId = message.roomId;
    set((s) => {
      const prev = s.messagesByRoom[roomId] ?? [];
      const filtered = prev.filter(
        (m) => !(m.clientMsgId === message.clientMsgId && m.status === 'pending'),
      );
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: dedupeMessages([...filtered, { ...message, status: 'sent' }]),
        },
      };
    });
  },

  getPendingMessages: () => {
    const all: ChatMessage[] = [];
    for (const list of Object.values(get().messagesByRoom)) {
      for (const m of list) {
        if (m.status === 'pending' || m.status === 'failed') all.push(m);
      }
    }
    return all;
  },

  setPresence: (roomId, users) =>
    set((s) => ({
      presenceByRoom: { ...s.presenceByRoom, [roomId]: users },
    })),

  setTyping: (roomId, userId, displayName, typing) =>
    set((s) => {
      const room = { ...(s.typingByRoom[roomId] ?? {}) };
      if (typing) room[userId] = { displayName, at: Date.now() };
      else delete room[userId];
      return { typingByRoom: { ...s.typingByRoom, [roomId]: room } };
    }),
}));

export function getLastMessageId(roomId: string): string | undefined {
  const list = useChatStore.getState().messagesByRoom[roomId] ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]!;
    if (m.status !== 'pending' && m.status !== 'failed') return m.id;
  }
  return undefined;
}
