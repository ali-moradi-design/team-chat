import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../config/env';
import type { Container } from '../container';
import type { Logger } from '../lib/logger';
import type { RunningServer } from '../server';
import { resetDatabase, seedDemo } from './seed';

async function clearUploads(dir: string): Promise<void> {
  const entries = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(entries.map((e) => rm(join(dir, e), { recursive: true, force: true })));
}

export async function resetDemo(
  config: Config,
  container: Container,
  server: RunningServer,
  logger: Logger,
): Promise<void> {
  logger.info('resetting demo data');
  await resetDatabase();
  await clearUploads(config.uploadDir);
  await seedDemo(container, logger);
  // Old tokens now point at users that no longer exist: drop every socket so clients sign in again.
  server.realtime.io.disconnectSockets(true);
}

/** Runs `task` every night at `hourUtc`:00 UTC. Returns a cancel function. */
export function scheduleNightly(
  hourUtc: number,
  task: () => Promise<void>,
  logger: Logger,
): () => void {
  let timer: NodeJS.Timeout;
  const arm = () => {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0),
    );
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    timer = setTimeout(() => {
      task()
        .catch((err) => logger.error({ err }, 'nightly task failed'))
        .finally(arm);
    }, next.getTime() - now.getTime());
    timer.unref();
  };
  arm();
  return () => clearTimeout(timer);
}
