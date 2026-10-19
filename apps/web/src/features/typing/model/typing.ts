import { create } from 'zustand';
import { LIMITS } from '@team-chat/shared';

interface TypingState {
  /** conversationId → userId → expiry timestamp */
  byConversation: Record<string, Record<string, number>>;
  set: (conversationId: string, userId: string, isTyping: boolean) => void;
  prune: () => void;
}

export const useTyping = create<TypingState>((set) => ({
  byConversation: {},
  set: (conversationId, userId, isTyping) =>
    set((s) => {
      const cur = s.byConversation[conversationId] ?? {};
      if (!isTyping) {
        if (!(userId in cur)) return s;
        const { [userId]: _x, ...rest } = cur;
        return { byConversation: { ...s.byConversation, [conversationId]: rest } };
      }
      return {
        byConversation: {
          ...s.byConversation,
          [conversationId]: { ...cur, [userId]: Date.now() + LIMITS.typingTtlMs },
        },
      };
    }),
  prune: () =>
    set((s) => {
      const now = Date.now();
      let changed = false;
      const next: TypingState['byConversation'] = {};
      for (const [cid, users] of Object.entries(s.byConversation)) {
        const alive = Object.fromEntries(Object.entries(users).filter(([, exp]) => exp > now));
        if (Object.keys(alive).length !== Object.keys(users).length) changed = true;
        next[cid] = alive;
      }
      return changed ? { byConversation: next } : s;
    }),
}));

const EMPTY: string[] = [];
export function useTypingUserIds(conversationId: string, meId: string): string[] {
  // Select a primitive key, derive the array with useMemo-like caching to avoid re-renders.
  const key = useTyping((s) =>
    Object.keys(s.byConversation[conversationId] ?? {})
      .filter((id) => id !== meId)
      .sort()
      .join(','),
  );
  return key ? key.split(',') : EMPTY;
}
