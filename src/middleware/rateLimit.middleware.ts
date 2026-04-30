import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { isRedisEnabled, redis } from '../config/redis.js';

function isLocalDevRequest(req: any) {
  if (env.NODE_ENV === 'production') {
    return false;
  }

  const origin = String(req.headers.origin ?? '');
  const host = String(req.headers.host ?? '');
  const forwardedFor = String(req.headers['x-forwarded-for'] ?? '');

  return (
    req.ip === '::1' ||
    req.ip === '127.0.0.1' ||
    req.ip === '::ffff:127.0.0.1' ||
    forwardedFor.includes('127.0.0.1') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:')
  );
}

function createRateLimiter(windowMs: number, max: number, message: string, keyPrefix: string, keyGenerator?: (req: any) => string) {
  const baseConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      data: null,
      message,
      error: 'RATE_LIMITED',
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
    },
    skip: isLocalDevRequest,
    keyGenerator,
  } as const;

  if (!isRedisEnabled()) {
    return rateLimit(baseConfig);
  }

  return rateLimit({
    ...baseConfig,
    store: new RedisStore({
      prefix: `rl:${keyPrefix}:`,
      sendCommand: (command: string, ...args: string[]) =>
        redis.call(command, ...args) as Promise<any>,
    }),
  });
}

export const generalRateLimiter = createRateLimiter(15 * 60 * 1000, 1200, 'Too many requests. Please slow down.', 'general');

export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 40, 'Too many auth attempts. Please try again later.', 'auth');

export const aiRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  20,
  'AI request limit reached. Please try again shortly.',
  'ai',
  (req) => req.user?.id ?? req.ip,
);
