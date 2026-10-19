import { Types } from 'mongoose';

export const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);
export const isObjectId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
export const iso = (d: Date | undefined | null): string | undefined =>
  d ? d.toISOString() : undefined;
