import type { Attachment, Message, Reaction } from '@team-chat/shared';
import { badRequest, forbidden } from '../../../lib/errors';
import { isAdmin, type UserRecord } from '../../users';

export interface StoredAttachment {
  fileId: string;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'file';
  width?: number;
  height?: number;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  authorId: string;
  text: string;
  attachments: StoredAttachment[];
  reactions: Reaction[];
  mentions: string[];
  mentionsAll: boolean;
  threadRootId?: string;
  replyCount: number;
  lastReplyAt?: Date;
  pinned: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  clientMsgId?: string;
}

const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u;

/** Loose emoji check: first grapheme must be pictographic and no ASCII letters are allowed. */
export function isValidEmoji(value: string): boolean {
  return EMOJI.test(value) && !/[A-Za-z]/.test(value) && [...value].length <= 12;
}

export function assertContent(text: string, attachmentCount: number): void {
  if (text.length === 0 && attachmentCount === 0) throw badRequest('Message is empty');
}

export function assertCanEdit(msg: MessageRecord, user: UserRecord): void {
  if (msg.deletedAt) throw badRequest('Message was deleted');
  if (msg.authorId !== user.id) throw forbidden('You can only edit your own messages');
}

export function canDelete(
  msg: MessageRecord,
  user: UserRecord,
  isChannelManager: boolean,
): boolean {
  return msg.authorId === user.id || isAdmin(user) || isChannelManager;
}

export function attachmentUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}

export function toAttachment(a: StoredAttachment): Attachment {
  return {
    ...a,
    url: attachmentUrl(a.fileId),
    ...(a.kind === 'image' ? { thumbUrl: `${attachmentUrl(a.fileId)}/thumb` } : {}),
  };
}

export function toMessage(m: MessageRecord): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    authorId: m.authorId,
    text: m.deletedAt ? '' : m.text,
    attachments: m.deletedAt ? [] : m.attachments.map(toAttachment),
    reactions: m.deletedAt ? [] : m.reactions,
    mentions: m.mentions,
    mentionsAll: m.mentionsAll,
    ...(m.threadRootId ? { threadRootId: m.threadRootId } : {}),
    replyCount: m.replyCount,
    ...(m.lastReplyAt ? { lastReplyAt: m.lastReplyAt.toISOString() } : {}),
    pinned: m.pinned,
    ...(m.editedAt ? { editedAt: m.editedAt.toISOString() } : {}),
    ...(m.deletedAt ? { deletedAt: m.deletedAt.toISOString() } : {}),
    createdAt: m.createdAt.toISOString(),
    ...(m.clientMsgId ? { clientMsgId: m.clientMsgId } : {}),
  };
}
