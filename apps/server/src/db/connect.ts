import mongoose from 'mongoose';
import type { Config } from '../config/env';
import type { Logger } from '../lib/logger';

export async function connectDb(
  config: Pick<Config, 'mongoUri' | 'isProd'>,
  logger: Logger,
): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  mongoose.set('autoIndex', false); // indexes are synced explicitly (see syncIndexes)
  await mongoose.connect(config.mongoUri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
  logger.info({ db: mongoose.connection.name }, 'mongodb connected');
  return mongoose;
}

export async function syncIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
