import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/team-chat'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  TRUST_PROXY: bool.default(false),
  JWT_SECRET: z.string().min(16).optional(),
  ACCESS_TOKEN_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  COOKIE_SECURE: bool.optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  REDIS_URL: z.string().optional(),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  DEMO_MODE: bool.default(false),
  DEMO_BOT: bool.optional(),
  SERVE_WEB_DIR: z.string().optional(),
});

export interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  isProd: boolean;
  isTest: boolean;
  port: number;
  host: string;
  logLevel: string;
  mongoUri: string;
  corsOrigins: string[];
  trustProxy: boolean;
  jwtSecret: string;
  accessTtlSec: number;
  refreshTtlDays: number;
  cookieSecure: boolean;
  uploadDir: string;
  maxFileBytes: number;
  redisUrl?: string;
  authRateLimit: number;
  demoMode: boolean;
  demoBot: boolean;
  serveWebDir?: string;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`,
    );
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  if (isProd && !env.JWT_SECRET)
    throw new Error('JWT_SECRET is required in production (min 16 chars)');
  return {
    nodeEnv: env.NODE_ENV,
    isProd,
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    host: env.HOST,
    logLevel: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    mongoUri: env.MONGODB_URI,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY,
    jwtSecret: env.JWT_SECRET ?? 'dev-only-secret-change-me-please',
    accessTtlSec: env.ACCESS_TOKEN_TTL_SEC,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    cookieSecure: env.COOKIE_SECURE ?? isProd,
    uploadDir: env.UPLOAD_DIR,
    maxFileBytes: env.MAX_FILE_BYTES,
    redisUrl: env.REDIS_URL,
    authRateLimit: env.AUTH_RATE_LIMIT,
    demoMode: env.DEMO_MODE,
    demoBot: env.DEMO_BOT ?? env.DEMO_MODE,
    serveWebDir: env.SERVE_WEB_DIR,
  };
}
