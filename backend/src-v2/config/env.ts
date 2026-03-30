export type RuntimeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  env: RuntimeEnv;
  port: number;
  appName: string;
  globalRateLimitPerMinute: number;
  allowInsecureDevAuth: boolean;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('Invalid PORT environment variable.');
  }
  return port;
}

function parsePositiveInt(raw: string | undefined, fallback: number, variableName: string): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${variableName} environment variable.`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV ?? 'development') as RuntimeEnv;
  if (!['development', 'test', 'production'].includes(env)) {
    throw new Error('NODE_ENV must be one of development/test/production.');
  }

  return {
    env,
    port: parsePort(process.env.PORT, 4001),
    appName: process.env.APP_NAME ?? 'smartcart-backend-v2',
    globalRateLimitPerMinute: parsePositiveInt(process.env.GLOBAL_RATE_LIMIT_PER_MINUTE, 240, 'GLOBAL_RATE_LIMIT_PER_MINUTE'),
    allowInsecureDevAuth: (process.env.ALLOW_INSECURE_DEV_AUTH ?? (env === 'development' ? 'true' : 'false')) === 'true',
  };
}
