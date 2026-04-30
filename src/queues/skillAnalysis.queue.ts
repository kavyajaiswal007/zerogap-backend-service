import { Queue } from 'bullmq';
import { isRedisEnabled, redisConnection } from '../config/redis.js';
import { SkillGapService } from '../modules/skillGap/skillGap.service.js';
import { ScoringService } from '../modules/scoring/scoring.service.js';
import { RoadmapService } from '../modules/roadmap/roadmap.service.js';
import { PeerBenchmarkService } from '../modules/peerBenchmark/peerBenchmark.service.js';
import { ProofAnalyzerService } from '../modules/proofAnalyzer/proofAnalyzer.service.js';
import { logger } from '../utils/logger.util.js';

let skillAnalysisQueue: Queue | null = null;

function safeJobId(prefix: string, id: string) {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function getSkillAnalysisQueue() {
  if (!isRedisEnabled()) {
    return null;
  }
  skillAnalysisQueue ??= new Queue('skill-analysis', redisConnection);
  return skillAnalysisQueue;
}

export async function runFullSkillAnalysis(userId: string) {
  await SkillGapService.analyze(userId);
  await ScoringService.recalculate(userId);
  const roadmap = await RoadmapService.getActive(userId);
  if (!roadmap) {
    await RoadmapService.generate(userId);
  }
  await PeerBenchmarkService.recalculate(userId);
}

export async function runGithubSyncAnalysis(userId: string) {
  try {
    await ProofAnalyzerService.analyzeGithub(userId);
  } catch (error) {
    logger.warn({
      message: 'GitHub sync skipped before skill analysis',
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
  }
  await runFullSkillAnalysis(userId);
}

export async function enqueueSkillAnalysis(userId: string) {
  const queue = getSkillAnalysisQueue();
  if (!queue) {
    setTimeout(async () => {
      try {
        await runFullSkillAnalysis(userId);
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

  await queue.add('full-analysis', { userId }, {
    jobId: safeJobId('full-analysis', userId),
    delay: 5 * 60 * 1000,
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export async function enqueueGithubSync(userId: string, githubUsername?: string) {
  const queue = getSkillAnalysisQueue();
  if (!queue) {
    setTimeout(async () => {
      try {
        await runGithubSyncAnalysis(userId);
      } catch (error) {
        logger.warn({
          message: 'Deferred GitHub sync analysis failed in no-redis mode',
          error: error instanceof Error ? error.message : String(error),
          userId,
          githubUsername,
        });
      }
    }, 0);
    return;
  }

  await queue.add('github-sync', { userId, githubUsername }, {
    jobId: safeJobId('github-sync', userId),
    delay: 2000,
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}
