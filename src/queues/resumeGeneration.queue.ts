import { Queue, Worker } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';
import { ResumeService } from '../modules/resume/resume.service.js';

export const resumeGenerationQueue = isRedisEnabled() ? new Queue('resume-generation', redisConnection) : null;

export async function enqueueResumePdf(userId: string, resumeId: string) {
  if (!resumeGenerationQueue) {
    await ResumeService.exportPdf(userId, resumeId);
    return;
  }
  await resumeGenerationQueue.add('generate-pdf', { userId, resumeId }, { removeOnComplete: 100, removeOnFail: 100 });
}

if (isRedisEnabled()) {
  new Worker('resume-generation', async (job) => {
    await ResumeService.exportPdf(job.data.userId as string, job.data.resumeId as string);
  }, redisConnection);
}
