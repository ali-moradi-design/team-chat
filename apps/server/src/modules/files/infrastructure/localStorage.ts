import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { FileStorage } from '../application/ports';

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  resolve(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return full;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { mode: 0o640 });
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    return stat(this.resolve(key)).then(
      () => true,
      () => false,
    );
  }
}
