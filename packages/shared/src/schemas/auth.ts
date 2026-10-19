import { z } from 'zod';
import { LIMITS } from '../constants';
import { plainText } from './common';
import { handleSchema, meSchema } from './user';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMinLength)
  .max(LIMITS.passwordMaxLength);

export const registerBody = z.object({
  name: plainText(LIMITS.nameMaxLength),
  handle: handleSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(LIMITS.passwordMaxLength),
});
export type LoginBody = z.infer<typeof loginBody>;

export const authResponse = z.object({
  accessToken: z.string(),
  user: meSchema,
});
export type AuthResponse = z.infer<typeof authResponse>;
