import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { Attachment, Message } from '@team-chat/shared';
import { cid, emitAck, startTestApp, type TestApp, type TestUser } from './helpers';

let app: TestApp;
let ali: TestUser;
let sara: TestUser;
let omid: TestUser;
let generalId: string;

beforeAll(async () => {
  app = await startTestApp();
  ali = await app.signUp('Ali', 'ali');
  sara = await app.signUp('Sara', 'sara');
  omid = await app.signUp('Omid', 'omid');
  generalId = (await app.http('/api/conversations', { token: ali.token })).body.conversations[0].id;
});
afterAll(() => app.stop());

const upload = async (user: TestUser, data: Buffer | Uint8Array, name: string, type: string) => {
  const form = new FormData();
  form.append('file', new Blob([data as never], { type }), name);
  return app.http('/api/files', { token: user.token, body: form });
};

const png = () =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: '#bc3908' } })
    .png()
    .toBuffer();

describe('files', () => {
  it('uploads an image, makes a thumbnail and serves it to members only', async () => {
    const res = await upload(ali, await png(), 'photo.png', 'image/png');
    expect(res.status).toBe(201);
    const file = res.body.file as Attachment;
    expect(file).toMatchObject({ kind: 'image', width: 800, height: 600 });

    // before sending: only the uploader can fetch it
    const media = (u: TestUser) => u.cookie.split('; ').find((c) => c.startsWith('tc_media='))!;
    expect((await app.http(file.url, { cookie: media(ali) })).status).toBe(200);
    expect((await app.http(file.url, { cookie: media(sara) })).status).toBe(403);
    expect((await app.http(file.url)).status).toBe(401);

    const a = await app.socket(ali.token);
    const sent = await emitAck<{ message: Message }>(a, 'message:send', {
      conversationId: generalId,
      clientMsgId: cid(),
      text: 'look',
      attachmentIds: [file.fileId],
    });
    expect(sent.ok && sent.data.message.attachments[0]?.thumbUrl).toBeTruthy();

    // reusing the same upload in a second message is refused
    const again = await emitAck(a, 'message:send', {
      conversationId: generalId,
      clientMsgId: cid(),
      text: 'again',
      attachmentIds: [file.fileId],
    });
    expect(again.ok).toBe(false);

    // after sending: any member can load it (thumbnail is webp)
    const thumb = await fetch(`${app.url}${file.thumbUrl}`, { headers: { cookie: media(sara) } });
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('content-type')).toBe('image/webp');
    expect(thumb.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('keeps private-channel files away from non-members', async () => {
    const priv = (
      await app.http('/api/conversations', {
        token: ali.token,
        body: { name: 'files-vault', isPrivate: true, memberIds: [sara.id] },
      })
    ).body.conversation;
    const file = (await upload(ali, Buffer.from('%PDF-1.4 hello'), 'secret.pdf', 'application/pdf'))
      .body.file as Attachment;
    const a = await app.socket(ali.token);
    await emitAck(a, 'message:send', {
      conversationId: priv.id,
      clientMsgId: cid(),
      text: '',
      attachmentIds: [file.fileId],
    });
    const cookie = (u: TestUser) => u.cookie.split('; ').find((c) => c.startsWith('tc_media='))!;
    expect((await app.http(file.url, { cookie: cookie(sara) })).status).toBe(200);
    expect((await app.http(file.url, { cookie: cookie(omid) })).status).toBe(403);
    const dl = await fetch(`${app.url}${file.url}`, { headers: { cookie: cookie(sara) } });
    expect(dl.headers.get('content-disposition')).toContain('attachment');
    expect(dl.headers.get('content-type')).toBe('application/octet-stream');
  });

  it('rejects wrong types, spoofed content and oversize files', async () => {
    expect((await upload(ali, Buffer.from('<svg/>'), 'x.svg', 'image/svg+xml')).status).toBe(415);
    expect(
      (await upload(ali, Buffer.from('MZ not an image'), 'evil.png', 'image/png')).status,
    ).toBe(415);
    expect((await upload(ali, Buffer.from('plain text'), 'ok.txt', 'text/plain')).status).toBe(201);
    expect(
      (await upload(ali, Buffer.alloc(11 * 1024 * 1024, 65), 'big.txt', 'text/plain')).status,
    ).toBe(413);
    const noFile = await app.http('/api/files', { token: ali.token, body: new FormData() });
    expect(noFile.status).toBe(400);
  });

  it('keeps UTF-8 file names', async () => {
    const res = await upload(ali, Buffer.from('سلام'), 'گزارش.txt', 'text/plain');
    expect(res.body.file.name).toBe('گزارش.txt');
  });
});
