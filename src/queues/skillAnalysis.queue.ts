import { Queue, Worker } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';
import { SkillGapService } from '../modules/skillGap/skillGap.service.js';
import { ScoringService } from '../modules/scoring/scoring.service.js';
import { RoadmapService } from '../modules/roadmap/roadmap.service.js';
import { PeerBenchmarkService } from '../modules/peerBenchmark/peerBenchmark.service.js';
import { logger } from '../utils/logger.util.js';

export const skillAnalysisQueue = isRedisEnabled() ? new Queue('skill-analysis', redisConnection) : null;

export async function enqueueSkillAnalysis(userId: string) {
  if (!skillAnalysisQueue) {
    setTimeout(async () => {
      try {
        await SkillGapService.analyze(userId);
        await ScoringService.recalculate(userId);
        const roadmap = await RoadmapService.getActive(userId);
        if (!roadmap) {
          await RoadmapService.generate(userId);
        }
        await PeerBenchmarkService.recalculate(userId);
      } catch (error) {
        logger.warn({
          message: 'Deferred skill analysis failed in no-redis mode',
          error: error instanceof Error ? error.message : String(error),
          userId,
        });
      }
    }, 0);
    return;
  }

  await skillAnalysisQueue.add('full-analysis', { userId }, {
    jobId: `full-analysis:${userId}`,
    delay: 5 * 60 * 1000,
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

if (isRedisEnabled()) {
  new Worker('skill-analysis', async (job) => {
    const userId = job.data.userId as string;
    await SkillGapService.analyze(userId);
    await ScoringService.recalculate(userId);
    const roadmap = await RoadmapService.getActive(userId);
    if (!roadmap) {
      await RoadmapService.generate(userId);
    }
    await PeerBenchmarkService.recalculate(userId);
  }, redisConnection);
}
