import { defineConfig } from '@playwright/test';

const DB = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/team-chat-e2e';
const serverEnv = {
  MONGODB_URI: DB,
  PORT: '3101',
  DEMO_MODE: 'true',
  DEMO_BOT: 'false',
  NODE_ENV: 'development',
  LOG_LEVEL: 'warn',
  AUTH_RATE_LIMIT: '100000',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:5273',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    {
      command: 'pnpm --filter @team-chat/server exec tsx src/index.ts',
      env: serverEnv,
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec vite --port 5273 --strictPort --host 127.0.0.1',
      env: { VITE_API_TARGET: 'http://127.0.0.1:3101' },
      url: 'http://127.0.0.1:5273',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
