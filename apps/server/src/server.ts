import { createServer, type Server } from 'node:http';
import type { Config } from './config/env';
import { createApp } from './app';
import { buildContainer, type Container } from './container';
import type { Logger } from './lib/logger';
import { createRealtime, type Realtime } from './socket/realtime';

export interface RunningServer {
  http: Server;
  container: Container;
  realtime: Realtime;
  port: number;
  close(): Promise<void>;
}

export async function startServer(config: Config, logger: Logger): Promise<RunningServer> {
  const container = buildContainer(config);
  const app = createApp(config, logger, container);
  const http = createServer(app);
  const realtime = await createRealtime(http, {
    config,
    logger,
    bus: container.bus,
    auth: container.auth.service,
    users: container.users,
    conversations: container.conversations,
    messages: container.messages,
    readStates: container.readStates,
  });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(config.port, config.host, () => resolve());
  });
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : config.port;

  return {
    http,
    container,
    realtime,
    port,
    async close() {
      await realtime.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
