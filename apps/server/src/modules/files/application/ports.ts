import type { Readable } from 'node:stream';
import type { FileRecord } from '../domain/file';

export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  /** Absolute path usable with res.sendFile (local storage only). */
  resolve(key: string): string;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  read?(key: string): Readable;
}

export interface FileRepository {
  create(input: Omit<FileRecord, 'id' | 'createdAt'>): Promise<FileRecord>;
  findById(id: string): Promise<FileRecord | null>;
  findOwnedUnattached(ownerId: string, ids: string[]): Promise<FileRecord[]>;
  markAttached(ids: string[], conversationId: string, messageId: string): Promise<void>;
  findOrphans(olderThan: Date, limit: number): Promise<FileRecord[]>;
  deleteMany(ids: string[]): Promise<void>;
}

export interface ImageProcessor {
  process(
    input: Buffer,
    mime: string,
  ): Promise<{
    original: Buffer;
    thumb: Buffer;
    width: number;
    height: number;
  }>;
}

export interface MembershipChecker {
  isMember(conversationId: string, userId: string): Promise<boolean>;
}
