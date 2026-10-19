import { pino, type Logger } from 'pino';
import type { Config } from '../config/env';

export type { Logger };

export function createLogger(config: Pick<Config, 'logLevel' | 'isProd'>): Logger {
  return pino({
    level: config.logLevel,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
    ...(config.isProd
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          },
        }),
  });
}
