import { env } from '@/shared/config';

export async function fetchRooms() {
  const res = await fetch(`${env.socketUrl}/api/rooms`);
  if (!res.ok) throw new Error('Failed to load rooms');
  return res.json() as Promise<{ rooms: Array<{ id: string; name: string; createdAt: string }> }>;
}

export async function fetchMessages(
  roomId: string,
  opts?: { before?: string; after?: string; limit?: number },
) {
  const q = new URLSearchParams();
  if (opts?.before) q.set('before', opts.before);
  if (opts?.after) q.set('after', opts.after);
  if (opts?.limit) q.set('limit', String(opts.limit));
  const res = await fetch(`${env.socketUrl}/api/rooms/${encodeURIComponent(roomId)}/messages?${q}`);
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json() as Promise<{
    roomId: string;
    messages: Array<{
      id: string;
      clientMsgId: string;
      roomId: string;
      userId: string;
      displayName: string;
      text: string;
      createdAt: string;
    }>;
  }>;
}
