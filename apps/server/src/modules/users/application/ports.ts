import type { WorkspaceRole } from '@team-chat/shared';
import type { NewUser, UserAuthRecord, UserRecord } from '../domain/user';

export interface UserRepository {
  create(input: NewUser): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findAuthByEmail(email: string): Promise<UserAuthRecord | null>;
  findByHandle(handle: string): Promise<UserRecord | null>;
  findByHandles(handles: string[]): Promise<UserRecord[]>;
  findByIds(ids: string[]): Promise<UserRecord[]>;
  list(): Promise<UserRecord[]>;
  count(): Promise<number>;
  setRole(id: string, role: WorkspaceRole): Promise<UserRecord | null>;
  setName(id: string, name: string): Promise<UserRecord | null>;
}
