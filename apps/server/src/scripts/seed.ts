import { loadConfig } from '../config/env';
import { buildContainer } from '../container';
import { connectDb, disconnectDb, syncIndexes } from '../db/connect';
import { resetDatabase, seedDemo } from '../demo/seed';
import { createLogger } from '../lib/logger';

const config = loadConfig();
const logger = createLogger(config);
await connectDb(config, logger);
await syncIndexes();
await resetDatabase();
await seedDemo(buildContainer(config), logger);
await disconnectDb();
logger.info('done — sign in as ali@demo.dev / sara@demo.dev (password: demo-pass-1234)');
