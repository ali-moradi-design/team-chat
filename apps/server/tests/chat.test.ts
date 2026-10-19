import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConversationSummary, Message } from '@team-chat/shared';
import {
  cid,
  emitAck,
  sendMsg,
  startTestApp,
  waitFor,
  type TestApp,
  type TestUser,
} from './helpers';

let app: TestApp;
let ali: TestUser;
let sara: TestUser;
let omid: TestUser;
let general: ConversationSummary;

beforeAll(async () => {
  app = await startTestApp();
  ali = await app.signUp('Ali', 'ali');
  sara = await app.signUp('Sara', 'sara');
  omid = await app.signUp('Omid', 'omid');
  const list = await app.http('/api/conversations', { token: ali.token });
  general = list.body.conversations[0];
});
afterAll(() => app.stop());

describe('messages over sockets', () => {
  it('sends, acks, fans out and dedupes by clientMsgId', async () => {
    const a = await app.socket(ali.token);
    const s = await app.socket(sara.token);
    const incoming = waitFor<{ message: Message }>(
      s,
      'message:new',
      (p) => p.message.text === 'hello **team**',
    );
    const clientMsgId = cid();
    const body = {
      conversationId: general.id,
      clientMsgId,
      text: 'hello **team**',
      attachmentIds: [],
    };
    const r1 = await emitAck<{ message: Message }>(a, 'message:send', body);
    const r2 = await emitAck<{ message: Message }>(a, 'message:send', body);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.data.message.id).toBe(r1.data.message.id);
    const got = await incoming;
    expect(got.message.authorId).toBe(ali.id);
    const history = await app.http(`/api/conversations/${general.id}/messages`, {
      token: sara.token,
    });
    expect(history.body.messages.filter((m: Message) => m.text === 'hello **team**')).toHaveLength(
      1,
    );
  });

  it('rejects invalid payloads and non-members', async () => {
    const a = await app.socket(ali.token);
    const bad = await emitAck(a, 'message:send', { conversationId: 'nope', text: 'x' });
    expect(bad.ok).toBe(false);
    const secret = await app.http('/api/conversations', {
      token: ali.token,
      body: { name: 'secret', isPrivate: true, memberIds: [] },
    });
    const o = await app.socket(omid.token);
    const res = await emitAck(o, 'message:send', {
      conversationId: secret.body.conversation.id,
      clientMsgId: cid(),
      text: 'let me in',
      attachmentIds: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('forbidden');
    const rest = await app.http(`/api/conversations/${secret.body.conversation.id}/messages`, {
      token: omid.token,
    });
    expect(rest.status).toBe(403);
  });

  it('paginates history with before/after cursors', async () => {
    const created = await app.http('/api/conversations', {
      token: ali.token,
      body: { name: 'pagination', memberIds: [] },
    });
    const id = created.body.conversation.id as string;
    const a = await app.socket(ali.token);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push((await sendMsg(a, id, `m${i}`)).id);
    const page1 = await app.http(`/api/conversations/${id}/messages?limit=5`, { token: ali.token });
    expect(page1.body.messages.map((m: Message) => m.text)).toEqual([
      'm7',
      'm8',
      'm9',
      'm10',
      'm11',
    ]);
    expect(page1.body.hasMoreOlder).toBe(true);
    const page2 = await app.http(
      `/api/conversations/${id}/messages?limit=5&beforeId=${page1.body.messages[0].id}`,
      { token: ali.token },
    );
    expect(page2.body.messages.map((m: Message) => m.text)).toEqual(['m2', 'm3', 'm4', 'm5', 'm6']);
    const after = await app.http(`/api/conversations/${id}/messages?limit=5&afterId=${ids[8]}`, {
      token: ali.token,
    });
    expect(after.body.messages.map((m: Message) => m.text)).toEqual(['m9', 'm10', 'm11']);
    expect(after.body.hasMoreNewer).toBe(false);
    const around = await app.http(`/api/conversations/${id}/messages?limit=6&aroundId=${ids[6]}`, {
      token: ali.token,
    });
    expect(around.body.messages.map((m: Message) => m.text)).toEqual([
      'm4',
      'm5',
      'm6',
      'm7',
      'm8',
      'm9',
    ]);
  });

  it('supports threads, reactions, edit, delete and pins', async () => {
    const a = await app.socket(ali.token);
    const s = await app.socket(sara.token);
    const root = await sendMsg(a, general.id, 'thread root');
    const threadUpdate = waitFor<{ rootId: string; replyCount: number }>(
      s,
      'thread:updated',
      (p) => p.rootId === root.id,
    );
    const reply = await sendMsg(s, general.id, 'a reply', { threadRootId: root.id });
    expect(reply.threadRootId).toBe(root.id);
    expect((await threadUpdate).replyCount).toBe(1);

    const thread = await app.http(`/api/messages/${root.id}/thread`, { token: ali.token });
    expect(thread.body.root.replyCount).toBe(1);
    expect(thread.body.replies.map((m: Message) => m.text)).toEqual(['a reply']);

    // replies stay out of the channel timeline
    const hist = await app.http(`/api/conversations/${general.id}/messages?limit=100`, {
      token: ali.token,
    });
    expect(hist.body.messages.some((m: Message) => m.id === reply.id)).toBe(false);

    // nested replies are rejected
    const nested = await emitAck(s, 'message:send', {
      conversationId: general.id,
      clientMsgId: cid(),
      text: 'x',
      attachmentIds: [],
      threadRootId: reply.id,
    });
    expect(nested.ok).toBe(false);

    // reactions toggle on and off
    const on = await emitAck<{ reactions: Array<{ emoji: string; userIds: string[] }> }>(
      s,
      'reaction:toggle',
      { messageId: root.id, emoji: '👍' },
    );
    expect(on.ok && on.data.reactions).toEqual([{ emoji: '👍', userIds: [sara.id] }]);
    await emitAck(a, 'reaction:toggle', { messageId: root.id, emoji: '👍' });
    const off = await emitAck<{ reactions: unknown[] }>(s, 'reaction:toggle', {
      messageId: root.id,
      emoji: '👍',
    });
    expect(off.ok && off.data.reactions).toEqual([{ emoji: '👍', userIds: [ali.id] }]);
    const letters = await emitAck(s, 'reaction:toggle', { messageId: root.id, emoji: 'abc' });
    expect(letters.ok).toBe(false);

    // edit: only the author
    const forbidden = await emitAck(s, 'message:edit', { messageId: root.id, text: 'hacked' });
    expect(forbidden.ok).toBe(false);
    const edited = await emitAck<{ message: Message }>(a, 'message:edit', {
      messageId: root.id,
      text: 'thread root (edited)',
    });
    expect(edited.ok && edited.data.message.editedAt).toBeTruthy();

    // pin + list
    await emitAck(a, 'message:pin', { messageId: root.id, pinned: true });
    const pins = await app.http(`/api/conversations/${general.id}/pins`, { token: sara.token });
    expect(pins.body.messages.map((m: Message) => m.id)).toContain(root.id);

    // delete: author or admin; members cannot delete others' messages
    const saraMsg = await sendMsg(s, general.id, 'sara says hi');
    const o = await app.socket(omid.token);
    expect((await emitAck(o, 'message:delete', { messageId: saraMsg.id })).ok).toBe(false);
    const del = await emitAck<{ message: Message }>(a, 'message:delete', { messageId: saraMsg.id }); // ali is admin
    expect(del.ok && del.data.message.deletedAt).toBeTruthy();
    expect(del.ok && del.data.message.text).toBe('');
  });

  it('keeps DMs private and finds them again', async () => {
    const dm = await app.http('/api/conversations/dm', {
      token: ali.token,
      body: { userIds: [sara.id] },
    });
    const dm2 = await app.http('/api/conversations/dm', {
      token: sara.token,
      body: { userIds: [ali.id] },
    });
    expect(dm.body.conversation.id).toBe(dm2.body.conversation.id);
    const o = await app.http(`/api/conversations/${dm.body.conversation.id}`, {
      token: omid.token,
    });
    expect(o.status).toBe(403);
  });
});

describe('unread, mentions, read receipts and search', () => {
  it('counts unread and mentions, clears them on read, notifies DM peers', async () => {
    const created = await app.http('/api/conversations', {
      token: ali.token,
      body: { name: 'unread-lab', memberIds: [sara.id, omid.id] },
    });
    const id = created.body.conversation.id as string;
    const a = await app.socket(ali.token);
    await sendMsg(a, id, 'plain');
    const m2 = await sendMsg(a, id, 'hey @sara look');
    await sendMsg(a, id, '@channel everyone');

    const list = await app.http('/api/conversations', { token: sara.token });
    const mine = list.body.conversations.find((c: ConversationSummary) => c.id === id);
    expect(mine.unreadCount).toBe(3);
    expect(mine.mentionCount).toBe(2);
    const omidList = await app.http('/api/conversations', { token: omid.token });
    expect(
      omidList.body.conversations.find((c: ConversationSummary) => c.id === id).mentionCount,
    ).toBe(1);

    const s = await app.socket(sara.token);
    const res = await emitAck(s, 'read:update', { conversationId: id, messageId: m2.id });
    expect(res.ok).toBe(true);
    const after = await app.http(`/api/conversations/${id}`, { token: sara.token });
    expect(after.body.conversation.unreadCount).toBe(1);

    // pointer never moves backwards
    const first = (
      await app.http(`/api/conversations/${id}/messages?limit=1&afterId=000000000000000000000000`, {
        token: sara.token,
      })
    ).body.messages[0];
    await emitAck(s, 'read:update', { conversationId: id, messageId: first.id });
    expect(
      (await app.http(`/api/conversations/${id}`, { token: sara.token })).body.conversation
        .unreadCount,
    ).toBe(1);

    // own messages never count as unread
    expect(
      (await app.http(`/api/conversations/${id}`, { token: ali.token })).body.conversation
        .unreadCount,
    ).toBe(0);
  });

  it('delivers read receipts to the other side of a DM', async () => {
    const dm = (
      await app.http('/api/conversations/dm', { token: ali.token, body: { userIds: [omid.id] } })
    ).body.conversation;
    const a = await app.socket(ali.token);
    const o = await app.socket(omid.token);
    const msg = await sendMsg(a, dm.id, 'ping');
    const receipt = waitFor(a, 'read:updated', (p: { userId: string }) => p.userId === omid.id);
    await emitAck(o, 'read:update', { conversationId: dm.id, messageId: msg.id });
    expect(await receipt).toMatchObject({ conversationId: dm.id, messageId: msg.id });
  });

  it('searches only inside conversations the user belongs to', async () => {
    const a = await app.socket(ali.token);
    const priv = (
      await app.http('/api/conversations', {
        token: ali.token,
        body: { name: 'vault', isPrivate: true, memberIds: [] },
      })
    ).body.conversation;
    await sendMsg(a, priv.id, 'zebra confidential plan');
    await sendMsg(a, general.id, 'zebra public parade');
    const asAli = await app.http('/api/search?q=zebra', { token: ali.token });
    expect(asAli.body.results).toHaveLength(2);
    const asSara = await app.http('/api/search?q=zebra', { token: sara.token });
    expect(asSara.body.results.map((m: Message) => m.text)).toEqual(['zebra public parade']);
    const filtered = await app.http(
      `/api/search?q=zebra&conversationId=${general.id}&authorId=${sara.id}`,
      { token: ali.token },
    );
    expect(filtered.body.results).toHaveLength(0);
  });
});

describe('channels', () => {
  it('enforces unique names, joining and leaving', async () => {
    const make = (name: string) =>
      app.http('/api/conversations', { token: sara.token, body: { name } });
    const first = await make('Design Team');
    expect(first.status).toBe(201);
    expect(first.body.conversation.name).toBe('Design-Team');
    expect((await make('design-team')).status).toBe(409);

    const id = first.body.conversation.id as string;
    const browse = await app.http('/api/conversations/browse', { token: omid.token });
    expect(browse.body.channels.map((c: { id: string }) => c.id)).toContain(id);
    expect(
      (await app.http(`/api/conversations/${id}/join`, { method: 'POST', token: omid.token }))
        .status,
    ).toBe(200);
    expect(
      (await app.http(`/api/conversations/${id}/leave`, { method: 'POST', token: omid.token }))
        .status,
    ).toBe(204);
    const o = await app.socket(omid.token);
    const res = await emitAck(o, 'message:send', {
      conversationId: id,
      clientMsgId: cid(),
      text: 'x',
      attachmentIds: [],
    });
    expect(res.ok).toBe(false); // left → room membership revoked immediately
  });

  it('rate limits message bursts', async () => {
    const a = await app.socket(ali.token);
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        emitAck(a, 'message:send', {
          conversationId: general.id,
          clientMsgId: cid(),
          text: `burst ${i}`,
          attachmentIds: [],
        }),
      ),
    );
    const limited = results.filter((r) => !r.ok && r.error.code === 'rate_limited');
    expect(limited.length).toBeGreaterThan(5);
  });

  it('shows presence to other users', async () => {
    const nina = await app.signUp('Nina', 'nina');
    const watcher = await app.socket(sara.token);
    const online = waitFor(
      watcher,
      'presence:update',
      (p: { userId: string; status: string }) => p.userId === nina.id && p.status === 'online',
    );
    const n = await app.socket(nina.token);
    expect((await online).status).toBe('online');
    const away = waitFor(
      watcher,
      'presence:update',
      (p: { userId: string; status: string }) => p.userId === nina.id && p.status === 'away',
    );
    n.emit('presence:set', { status: 'away' });
    expect((await away).status).toBe('away');
    const offline = waitFor(
      watcher,
      'presence:update',
      (p: { userId: string; status: string }) => p.userId === nina.id && p.status === 'offline',
      8000,
    );
    n.disconnect();
    expect((await offline).status).toBe('offline');
  });
});
