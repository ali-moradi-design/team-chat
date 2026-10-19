export const ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'payload_too_large',
  'unsupported_media',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export type Ack<T = undefined> =
  (T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; error: ApiError };
