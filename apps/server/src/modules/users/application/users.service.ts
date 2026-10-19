import type { WorkspaceRole } from '@team-chat/shared';
import { forbidden, notFound, conflict } from '../../../lib/errors';
import type { EventBus } from '../../../lib/eventBus';
import { sanitizeName } from '../../../lib/sanitize';
import {
  hueFromHandle,
  isAdmin,
  toPublicUser,
  type NewUser,
  type UserRecord,
} from '../domain/user';
import type { UserRepository } from './ports';

export class UsersService {
  constructor(
    private readonly repo: UserRepository,
    private readonly bus: EventBus,
  ) {}

  /** Creates a user. The very first user becomes the workspace admin. */
  async create(input: Omit<NewUser, 'role'> & { role?: WorkspaceRole }): Promise<UserRecord> {
    const [byHandle, existingCount] = await Promise.all([
      this.repo.findByHandle(input.handle),
      this.repo.count(),
    ]);
    if (byHandle) throw conflict('Handle is already taken');
    if (await this.repo.findAuthByEmail(input.email)) throw conflict('Email is already registered');
    const role = input.role ?? (existingCount === 0 ? 'admin' : 'member');
    try {
      const user = await this.repo.create({ ...input, name: sanitizeName(input.name, 48), role });
      this.bus.publish('user.updated', { user: toPublicUser(user) });
      return user;
    } catch (e) {
      if (isDuplicateKey(e)) throw conflict('Handle or email is already registered');
      throw e;
    }
  }

  findById = (id: string) => this.repo.findById(id);
  findAuthByEmail = (email: string) => this.repo.findAuthByEmail(email);
  findByHandles = (handles: string[]) => this.repo.findByHandles(handles);
  findByIds = (ids: string[]) => this.repo.findByIds(ids);
  list = () => this.repo.list();

  async getOrThrow(id: string): Promise<UserRecord> {
    const u = await this.repo.findById(id);
    if (!u) throw notFound('User not found');
    return u;
  }

  async changeRole(actor: UserRecord, targetId: string, role: WorkspaceRole): Promise<UserRecord> {
    if (!isAdmin(actor)) throw forbidden('Only admins can change roles');
    if (actor.id === targetId && role !== 'admin') throw forbidden('You cannot demote yourself');
    const updated = await this.repo.setRole(targetId, role);
    if (!updated) throw notFound('User not found');
    this.bus.publish('user.updated', { user: toPublicUser(updated) });
    return updated;
  }

  async rename(actorId: string, name: string): Promise<UserRecord> {
    const updated = await this.repo.setName(actorId, sanitizeName(name, 48));
    if (!updated) throw notFound('User not found');
    this.bus.publish('user.updated', { user: toPublicUser(updated) });
    return updated;
  }
}

export function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
}

export { hueFromHandle };
