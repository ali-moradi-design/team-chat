import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, notFound, AppError } from '../../../lib/errors';
import type { UserRecord } from '../../users';
import type { StoredAttachment } from '../../messages';
import {
  isAllowedMime,
  isImageMime,
  matchesSignature,
  sanitizeFileName,
  type FileRecord,
} from '../domain/file';
import type { FileRepository, FileStorage, ImageProcessor, MembershipChecker } from './ports';

export class FilesService {
  constructor(
    private readonly repo: FileRepository,
    private readonly storage: FileStorage,
    private readonly images: ImageProcessor,
    private readonly membership: () => MembershipChecker,
    private readonly maxBytes: number,
  ) {}

  async upload(
    user: UserRecord,
    input: { buffer: Buffer; originalName: string; mime: string },
  ): Promise<FileRecord> {
    const { buffer, mime } = input;
    if (buffer.length === 0) throw badRequest('Empty file');
    if (buffer.length > this.maxBytes) throw new AppError('payload_too_large', 'File is too large');
    if (!isAllowedMime(mime))
      throw new AppError('unsupported_media', 'This file type is not allowed');
    if (!matchesSignature(mime, buffer))
      throw new AppError('unsupported_media', 'File content does not match its type');

    const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
    const name = sanitizeFileName(input.originalName);

    if (isImageMime(mime)) {
      let processed;
      try {
        processed = await this.images.process(buffer, mime);
      } catch {
        throw new AppError('unsupported_media', 'Image could not be read');
      }
      await this.storage.save(key, processed.original);
      await this.storage.save(`${key}.thumb`, processed.thumb);
      return this.repo.create({
        ownerId: user.id,
        name,
        mime,
        size: processed.original.length,
        kind: 'image',
        width: processed.width,
        height: processed.height,
        storageKey: key,
        thumbKey: `${key}.thumb`,
      });
    }

    await this.storage.save(key, buffer);
    return this.repo.create({
      ownerId: user.id,
      name,
      mime,
      size: buffer.length,
      kind: 'file',
      storageKey: key,
    });
  }

  /** Resolves uploaded-but-unsent files for a new message (must be the sender's own). */
  async resolveForSend(userId: string, fileIds: string[]): Promise<StoredAttachment[]> {
    if (fileIds.length === 0) return [];
    const files = await this.repo.findOwnedUnattached(userId, fileIds);
    if (files.length !== fileIds.length) throw badRequest('Unknown or already used attachment');
    return files.map((f) => ({
      fileId: f.id,
      name: f.name,
      mime: f.mime,
      size: f.size,
      kind: f.kind,
      ...(f.width ? { width: f.width } : {}),
      ...(f.height ? { height: f.height } : {}),
    }));
  }

  markAttached(fileIds: string[], conversationId: string, messageId: string): Promise<void> {
    return this.repo.markAttached(fileIds, conversationId, messageId);
  }

  /** Access: the uploader (before sending) or any member of the conversation it was sent to. */
  async getForDownload(
    user: UserRecord,
    fileId: string,
    variant: 'original' | 'thumb',
  ): Promise<{ file: FileRecord; path: string }> {
    const file = await this.repo.findById(fileId);
    if (!file) throw notFound('File not found');
    const allowed =
      file.ownerId === user.id ||
      (file.conversationId !== undefined &&
        (await this.membership().isMember(file.conversationId, user.id)));
    if (!allowed) throw forbidden('No access to this file');
    const key = variant === 'thumb' ? file.thumbKey : file.storageKey;
    if (!key) throw notFound('Variant not available');
    return { file, path: this.storage.resolve(key) };
  }

  /** Removes uploads that were never attached to a message. */
  async sweepOrphans(maxAgeMs = 24 * 3600 * 1000): Promise<number> {
    const orphans = await this.repo.findOrphans(new Date(Date.now() - maxAgeMs), 200);
    for (const f of orphans) {
      await this.storage.remove(f.storageKey);
      if (f.thumbKey) await this.storage.remove(f.thumbKey);
    }
    await this.repo.deleteMany(orphans.map((f) => f.id));
    return orphans.length;
  }
}
