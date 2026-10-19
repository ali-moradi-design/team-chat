import { create } from 'zustand';
import type { PresenceStatus, User } from '@team-chat/shared';

interface UsersState {
  byId: Record<string, User>;
  byHandle: Record<string, string>;
  presence: Record<string, PresenceStatus>;
  loaded: boolean;
  setAll: (users: User[]) => void;
  upsert: (user: User) => void;
  setPresence: (userId: string, status: PresenceStatus) => void;
  setPresenceSnapshot: (snapshot: Record<string, PresenceStatus>) => void;
}

export const useUsers = create<UsersState>((set) => ({
  byId: {},
  byHandle: {},
  presence: {},
  loaded: false,
  setAll: (users) =>
    set((s) => {
      const byId = { ...s.byId };
      const byHandle = { ...s.byHandle };
      for (const u of users) {
        byId[u.id] = u;
        byHandle[u.handle] = u.id;
      }
      return { byId, byHandle, loaded: true };
    }),
  upsert: (user) =>
    set((s) => ({
      byId: { ...s.byId, [user.id]: user },
      byHandle: { ...s.byHandle, [user.handle]: user.id },
    })),
  setPresence: (userId, status) =>
    set((s) => {
      if (status === 'offline') {
        if (!(userId in s.presence)) return s;
        const { [userId]: _gone, ...rest } = s.presence;
        return { presence: rest };
      }
      return s.presence[userId] === status ? s : { presence: { ...s.presence, [userId]: status } };
    }),
  setPresenceSnapshot: (snapshot) => set({ presence: snapshot }),
}));

export const useUser = (id: string | undefined): User | undefined => useUsers((s) => (id ? s.byId[id] : undefined));

/** Bots are always shown as online. */
export function usePresenceOf(id: string | undefined): PresenceStatus {
  return useUsers((s) => {
    if (!id) return 'offline';
    if (s.byId[id]?.isBot) return 'online';
    return s.presence[id] ?? 'offline';
  });
}

export const displayName = (u: User | undefined): string => u?.name ?? 'Unknown';
