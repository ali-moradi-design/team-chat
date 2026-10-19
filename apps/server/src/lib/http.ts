import type { Request } from 'express';
import type { ZodType } from 'zod';
import { badRequest, unauthorized } from './errors';
import type { UserRecord } from '../modules/users/domain/user';

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      'Validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export function currentUser(req: Request): UserRecord {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== 'string') throw badRequest(`Missing ${name}`);
  return v;
}
