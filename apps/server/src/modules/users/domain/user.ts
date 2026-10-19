import type { User, WorkspaceRole } from '@team-chat/shared';

export interface UserRecord {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: WorkspaceRole;
  hue: number;
  isBot: boolean;
  disabled: boolean;
  createdAt: Date;
}

export interface UserAuthRecord extends UserRecord {
  passwordHash: string;
}

export interface NewUser {
  name: string;
  handle: string;
  email: string;
  passwordHash: string;
  role: WorkspaceRole;
  isBot?: boolean;
}

/** Deterministic avatar hue (0-359) from a handle. */
export function hueFromHandle(handle: string): number {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 360;
  return h;
}

export function toPublicUser(u: UserRecord): User {
  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    role: u.role,
    hue: u.hue,
    isBot: u.isBot,
    createdAt: u.createdAt.toISOString(),
  };
}

export const isAdmin = (u: Pick<UserRecord, 'role'>): boolean => u.role === 'admin';
