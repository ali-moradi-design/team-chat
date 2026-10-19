import { z } from 'zod';
import { LIMITS } from '../constants';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export type ObjectId = z.infer<typeof objectId>;

export const isoDate = z.string();

export const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // eslint-disable-next-line no-control-regex
    .refine((v) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v), 'Invalid characters');

export const emojiSchema = z.string().min(1).max(LIMITS.maxEmojiLength);

export const presenceStatus = z.enum(['online', 'away', 'offline']);
export type PresenceStatus = z.infer<typeof presenceStatus>;
