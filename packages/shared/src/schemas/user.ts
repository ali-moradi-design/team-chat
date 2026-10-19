import { z } from 'zod';
import { LIMITS } from '../constants';
import { objectId, plainText } from './common';

export const workspaceRole = z.enum(['admin', 'member']);
export type WorkspaceRole = z.infer<typeof workspaceRole>;

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.handleMinLength)
  .max(LIMITS.handleMaxLength)
  .regex(/^[a-z0-9_]+$/, 'Use letters, digits and underscore only');

export const userSchema = z.object({
  id: objectId,
  name: z.string(),
  handle: z.string(),
  role: workspaceRole,
  hue: z.number().int().min(0).max(359),
  isBot: z.boolean().default(false),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const meSchema = userSchema.extend({ email: z.string() });
export type Me = z.infer<typeof meSchema>;

export const updateRoleBody = z.object({ role: workspaceRole });
export const updateProfileBody = z.object({ name: plainText(LIMITS.nameMaxLength) });
