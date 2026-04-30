import { Worker, type Job } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';
import { JobMarketService } from '../modules/jobMarket/jobMarket.service.js';
import { ResumeService } from '../modules/resume/resume.service.js';
import { runFullSkillAnalysis, runGithubSyncAnalysis } from '../queues/skillAnalysis.queue.js';
import { logger } from '../utils/logger.util.js';

let workers: Worker[] = [];
let shutdownRegistered = false;

function attachWorkerLogs(worker: Worker) {
  worker.on('completed', (job) => {
    logger.info({
      message: '[Worker] Job completed',
      queue: worker.name,
      jobId: job.id,
      jobName: job.name,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error({
      message: '[Worker] Job failed',
      queue: worker.name,
      jobId: job?.id,
      jobName: job?.name,
      error: error.message,
    });
  });
}

async function closeWorkers(signal: string) {
  logger.info({ message: '[Worker] Shutting down workers', signal });
  await Promise.allSettled(workers.map((worker) => worker.close()));
  workers = [];
}

function registerShutdown() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void closeWorkers(signal).finally(() => process.exit(0));
    });
  }
}

async function handleSkillAnalysisJob(job: Job) {
  const userId = String(job.data.userId ?? '');
  if (!userId) {
    throw new Error('Missing userId for skill-analysis job');
  }

  if (job.name === 'github-sync') {
    await runGithubSyncAnalysis(userId);
    return;
  }

  await runFullSkillAnalysis(userId);
}

export function startWorkers() {
  if (workers.length) {
    return workers;
  }

  if (!isRedisEnabled()) {
    logger.info('[Worker] Redis disabled; BullMQ workers not started');
    return workers;
  }

  workers = [
    new Worker('skill-analysis', handleSkillAnalysisJob, {
      ...redisConnection,
      concurrency: 5,
    }),
    new Worker('job-scraping', async (job) => {
      await JobMarketService.refreshRole(String(job.data.role ?? 'Full Stack Developer'));
    }, {
      ...redisConnection,
      concurrency: 2,
    }),
    new Worker('resume-generation', async (job) => {
      await ResumeService.exportPdf(String(job.data.userId), String(job.data.resumeId));
    }, {
      ...redisConnection,
      concurrency: 3,
    }),
  ];

  workers.forEach(attachWorkerLogs);
  registerShutdown();
  logger.info({ message: '[Worker] BullMQ workers started', count: workers.length });
  return workers;
}
