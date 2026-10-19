import type { UserRecord } from '../modules/users/domain/user';

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

export {};
