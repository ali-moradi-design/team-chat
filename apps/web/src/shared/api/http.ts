import type { ApiError, AuthResponse } from '@team-chat/shared';
import { tokenExpiry, tokenStore } from './token';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiError['code'] | 'network';
  readonly details?: unknown;

  constructor(
    status: number,
    code: ApiError['code'] | 'network',
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface Options {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the Authorization header and the 401 → refresh → retry dance. */
  anonymous?: boolean;
}

let refreshing: Promise<AuthResponse | null> | null = null;

/** Single-flight: concurrent 401s share one refresh request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'x-requested-with': 'team-chat' },
        credentials: 'same-origin',
      });
      if (!res.ok) {
        tokenStore.set(null);
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      tokenStore.set(data.accessToken);
      return data;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function send(path: string, opts: Options, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined && !(opts.body instanceof FormData))
    headers['content-type'] = 'application/json';
  if (token && !opts.anonymous) headers.authorization = `Bearer ${token}`;
  try {
    return await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      credentials: 'same-origin',
      signal: opts.signal ?? null,
      body:
        opts.body === undefined
          ? null
          : opts.body instanceof FormData
            ? opts.body
            : JSON.stringify(opts.body),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiClientError(0, 'network', 'Network error');
  }
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let res = await send(path, opts, tokenStore.get());
  if (res.status === 401 && !opts.anonymous) {
    const session = await refreshSession();
    if (session) res = await send(path, opts, session.accessToken);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = (data as { error?: ApiError } | undefined)?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? 'internal',
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return data as T;
}

/** Calls `onTokenRefreshed` shortly before the access token expires. Returns a stop function. */
export function scheduleTokenRefresh(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (token: string | null) => {
    clearTimeout(timer);
    if (!token) return;
    const exp = tokenExpiry(token);
    if (!exp) return;
    const delay = Math.max(5_000, exp - Date.now() - 60_000);
    timer = setTimeout(() => void refreshSession(), delay);
  };
  arm(tokenStore.get());
  const off = tokenStore.subscribe(arm);
  return () => {
    clearTimeout(timer);
    off();
  };
}
