import { Queue } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';
import { ResumeService } from '../modules/resume/resume.service.js';

let resumeGenerationQueue: Queue | null = null;

export function getResumeGenerationQueue() {
  if (!isRedisEnabled()) {
    return null;
  }
  resumeGenerationQueue ??= new Queue('resume-generation', redisConnection);
  return resumeGenerationQueue;
}

export async function enqueueResumePdf(userId: string, resumeId: string) {
  const queue = getResumeGenerationQueue();
  if (!queue) {
    await ResumeService.exportPdf(userId, resumeId);
    return;
  }
  await queue.add('generate-pdf', { userId, resumeId }, { removeOnComplete: 100, removeOnFail: 100 });
}
