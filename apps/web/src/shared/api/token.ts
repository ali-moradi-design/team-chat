type Listener = (token: string | null) => void;

let token: string | null = null;
const listeners = new Set<Listener>();

export const tokenStore = {
  get: () => token,
  set(next: string | null) {
    token = next;
    listeners.forEach((l) => l(next));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Expiry (ms since epoch) of a JWT, or null when it cannot be read. */
export function tokenExpiry(jwt: string): number | null {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
