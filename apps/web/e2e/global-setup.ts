import { execFileSync } from 'node:child_process';

const DB = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/team-chat-e2e';

/** Fresh demo data (+ a long channel for scroll tests) before every run. */
export default function globalSetup() {
  const env = { ...process.env, MONGODB_URI: DB, LOG_LEVEL: 'warn', NODE_ENV: 'development' };
  execFileSync('pnpm', ['--filter', '@team-chat/server', 'exec', 'tsx', 'src/scripts/seed.ts'], {
    env,
    stdio: 'inherit',
  });
  execFileSync(
    'pnpm',
    ['--filter', '@team-chat/server', 'exec', 'tsx', 'src/scripts/bulk.ts', 'random', '2500'],
    { env, stdio: 'inherit' },
  );
}
