import { createRequire } from 'node:module';
import { pino, type Logger } from 'pino';
import type { Config } from '../config/env';

export type { Logger };

const require = createRequire(import.meta.url);

/** pino-pretty is a dev dependency: fall back to JSON logs when it is not installed. */
function hasPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export function createLogger(config: Pick<Config, 'logLevel' | 'isProd'>): Logger {
  return pino({
    level: config.logLevel,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
    ...(config.isProd || !hasPretty()
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          },
        }),
  });
}
