import { ALLOWED_FILE_MIME, ALLOWED_IMAGE_MIME } from '@team-chat/shared';

export interface FileRecord {
  id: string;
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'file';
  width?: number;
  height?: number;
  storageKey: string;
  thumbKey?: string;
  conversationId?: string;
  messageId?: string;
  createdAt: Date;
}

export const isAllowedMime = (mime: string): boolean =>
  (ALLOWED_FILE_MIME as readonly string[]).includes(mime);
export const isImageMime = (mime: string): boolean =>
  (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime);

/** Keeps a readable name but removes path parts, control characters and bidi overrides. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const clean = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return clean || 'file';
}

/** Verifies that the bytes really look like the declared type (the client-sent mime is untrusted). */
export function matchesSignature(mime: string, buf: Buffer): boolean {
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  switch (mime) {
    case 'image/png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/jpeg':
      return startsWith(0xff, 0xd8, 0xff);
    case 'image/gif':
      return buf.subarray(0, 6).toString('ascii').startsWith('GIF8');
    case 'image/webp':
      return (
        buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'application/pdf':
      return buf.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'application/zip':
      return startsWith(0x50, 0x4b, 0x03, 0x04) || startsWith(0x50, 0x4b, 0x05, 0x06);
    case 'text/plain':
    case 'text/csv':
    case 'application/json': {
      if (buf.includes(0)) return false;
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buf);
        return true;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}
