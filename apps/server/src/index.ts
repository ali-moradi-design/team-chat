import { loadConfig } from './config/env';
import { connectDb, disconnectDb, syncIndexes } from './db/connect';
import { startBot } from './demo/bot';
import { resetDemo, scheduleNightly } from './demo/reset';
import { createLogger } from './lib/logger';
import { startServer } from './server';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);

  await connectDb(config, logger);
  await syncIndexes();
  const server = await startServer(config, logger);
  logger.info({ port: server.port, env: config.nodeEnv }, 'team-chat server listening');

  const orphanTimer = setInterval(
    () =>
      void server.container.files.service
        .sweepOrphans()
        .catch((err) => logger.warn({ err }, 'orphan sweep failed')),
    60 * 60 * 1000,
  );
  orphanTimer.unref();

  const stopTasks: Array<() => void> = [];
  if (config.demoBot) stopTasks.push(await startBot(server.container, logger));
  if (config.demoMode) {
    stopTasks.push(
      scheduleNightly(3, () => resetDemo(config, server.container, server, logger), logger),
    );
  }

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'shutting down');
    clearInterval(orphanTimer);
    stopTasks.forEach((stop) => stop());
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
