import { Queue } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';

const TOP_ROLES = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Analyst'];

let jobScrapingQueue: Queue | null = null;

export function getJobScrapingQueue() {
  if (!isRedisEnabled()) {
    return null;
  }
  jobScrapingQueue ??= new Queue('job-scraping', redisConnection);
  return jobScrapingQueue;
}

export async function scheduleJobScraping() {
  const queue = getJobScrapingQueue();
  if (!queue) {
    return;
  }
  for (const role of TOP_ROLES) {
    await queue.add('refresh-role', { role }, {
      jobId: `refresh-role:${role}`,
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    });
  }
}
