import { Queue, Worker } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';
import { JobMarketService } from '../modules/jobMarket/jobMarket.service.js';

const TOP_ROLES = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Analyst'];

export const jobScrapingQueue = isRedisEnabled() ? new Queue('job-scraping', redisConnection) : null;

export async function scheduleJobScraping() {
  if (!jobScrapingQueue) {
    return;
  }
  for (const role of TOP_ROLES) {
    await jobScrapingQueue.add('refresh-role', { role }, {
      jobId: `refresh-role:${role}`,
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    });
  }
}

if (isRedisEnabled()) {
  new Worker('job-scraping', async (job) => {
    await JobMarketService.refreshRole(job.data.role as string);
  }, redisConnection);
}
