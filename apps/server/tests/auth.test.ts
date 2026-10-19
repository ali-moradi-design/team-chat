import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers';

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.stop());

describe('auth', () => {
  it('makes the first user an admin and joins #general', async () => {
    const ali = await app.signUp('Ali', 'ali');
    const me = await app.http('/api/auth/me', { token: ali.token });
    expect(me.body.user.role).toBe('admin');
    const convs = await app.http('/api/conversations', { token: ali.token });
    expect(convs.body.conversations.map((c: { name: string }) => c.name)).toEqual(['general']);

    const sara = await app.signUp('Sara', 'sara');
    const me2 = await app.http('/api/auth/me', { token: sara.token });
    expect(me2.body.user.role).toBe('member');
    const convs2 = await app.http('/api/conversations', { token: sara.token });
    expect(convs2.body.conversations[0].members).toHaveLength(2);
  });

  it('rejects duplicates and weak input', async () => {
    const dup = await app.http('/api/auth/register', {
      body: { name: 'X', handle: 'ali', email: 'other@example.com', password: 'long-enough-pass' },
    });
    expect(dup.status).toBe(409);
    const weak = await app.http('/api/auth/register', {
      body: { name: 'X', handle: 'xx_y', email: 'x@example.com', password: 'short' },
    });
    expect(weak.status).toBe(400);
  });

  it('logs in and rejects bad credentials with the same message', async () => {
    const ok = await app.http('/api/auth/login', {
      body: { email: 'ali@example.com', password: 'correct-horse-battery' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    const wrong = await app.http('/api/auth/login', {
      body: { email: 'ali@example.com', password: 'nope-nope-nope' },
    });
    const unknown = await app.http('/api/auth/login', {
      body: { email: 'nobody@example.com', password: 'nope-nope-nope' },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('requires a bearer token', async () => {
    expect((await app.http('/api/conversations')).status).toBe(401);
    expect((await app.http('/api/conversations', { token: 'garbage' })).status).toBe(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const u = await app.signUp('Rota', 'rota');
    const refreshCookie = u.cookie.split('; ').find((c) => c.startsWith('tc_refresh='))!;
    const headers = { 'x-requested-with': 'team-chat' };

    const noHeader = await app.http('/api/auth/refresh', { method: 'POST', cookie: refreshCookie });
    expect(noHeader.status).toBe(400);

    const first = await app.http('/api/auth/refresh', {
      method: 'POST',
      cookie: refreshCookie,
      headers,
    });
    expect(first.status).toBe(200);
    const newCookie = first.cookies.find((c) => c.startsWith('tc_refresh='))!.split(';')[0]!;
    expect(newCookie).not.toBe(refreshCookie);

    // Replaying the old token inside the grace window still gives an access token, but no new cookie.
    const replay = await app.http('/api/auth/refresh', {
      method: 'POST',
      cookie: refreshCookie,
      headers,
    });
    expect(replay.status).toBe(200);
    expect(replay.cookies.find((c) => c.startsWith('tc_refresh='))).toBeUndefined();

    const out = await app.http('/api/auth/logout', { method: 'POST', cookie: newCookie });
    expect(out.status).toBe(204);
    const after = await app.http('/api/auth/refresh', {
      method: 'POST',
      cookie: newCookie,
      headers,
    });
    expect(after.status).toBe(401);
  });

  it('rejects socket connections without a valid token', async () => {
    await expect(app.socket('bad-token')).rejects.toBeTruthy();
  });
});
