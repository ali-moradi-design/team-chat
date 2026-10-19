import { create } from 'zustand';
import type { AuthResponse, LoginBody, Me, RegisterBody } from '@team-chat/shared';
import { api, refreshSession } from '@/shared/api/http';
import { tokenStore } from '@/shared/api/token';

type Status = 'loading' | 'authed' | 'anon';

interface SessionState {
  status: Status;
  me: Me | null;
  demo: boolean;
  bootstrap: () => Promise<void>;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  demoLogin: (handle: 'ali' | 'sara') => Promise<void>;
  logout: () => Promise<void>;
  setMe: (me: Me) => void;
}

const accept = (set: (s: Partial<SessionState>) => void, res: AuthResponse) => {
  tokenStore.set(res.accessToken);
  set({ status: 'authed', me: res.user });
};

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  me: null,
  demo: false,
  async bootstrap() {
    const [session, config] = await Promise.all([
      refreshSession(),
      api<{ demo: boolean }>('/api/config', { anonymous: true }).catch(() => ({ demo: false })),
    ]);
    set(
      session
        ? { status: 'authed', me: session.user, demo: config.demo }
        : { status: 'anon', me: null, demo: config.demo },
    );
  },
  async login(body) {
    accept(set, await api<AuthResponse>('/api/auth/login', { body, anonymous: true }));
  },
  async register(body) {
    accept(set, await api<AuthResponse>('/api/auth/register', { body, anonymous: true }));
  },
  async demoLogin(handle) {
    accept(set, await api<AuthResponse>('/api/auth/demo', { body: { handle }, anonymous: true }));
  },
  async logout() {
    await api('/api/auth/logout', { method: 'POST', anonymous: true }).catch(() => undefined);
    tokenStore.set(null);
    set({ status: 'anon', me: null });
  },
  setMe: (me) => set({ me }),
}));
