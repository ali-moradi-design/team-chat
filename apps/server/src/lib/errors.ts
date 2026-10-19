import type { ApiError, ErrorCode } from '@team-chat/shared';

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  unsupported_media: 415,
  internal: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
  get status(): number {
    return STATUS[this.code];
  }
  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export const badRequest = (m = 'Bad request', d?: unknown) => new AppError('bad_request', m, d);
export const unauthorized = (m = 'Unauthorized') => new AppError('unauthorized', m);
export const forbidden = (m = 'Forbidden') => new AppError('forbidden', m);
export const notFound = (m = 'Not found') => new AppError('not_found', m);
export const conflict = (m = 'Conflict') => new AppError('conflict', m);
