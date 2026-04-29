import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.util.js';

let redisEnabled = false;

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: () => null,
});

redis.on('error', (error) => {
  redisEnabled = false;
  logger.warn({
    message: 'Redis unavailable, falling back to degraded mode',
    error: error.message,
  });
});

export async function ensureRedisConnection() {
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
    redisEnabled = true;
    return true;
  } catch (error) {
    redisEnabled = false;
    logger.warn({
      message: 'Redis connection failed during bootstrap',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function isRedisEnabled() {
  return redisEnabled;
}

export const redisConnection = {
  connection: redis,
};
