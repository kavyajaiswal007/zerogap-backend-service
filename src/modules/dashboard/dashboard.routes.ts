import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { getProfileOrThrow } from '../../utils/db.util.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { redis, isRedisEnabled } from '../../config/redis.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { RoadmapService } from '../roadmap/roadmap.service.js';
import { PeerBenchmarkService } from '../peerBenchmark/peerBenchmark.service.js';
import { HireMeService } from '../hireMe/hireMe.service.js';
import { SkillGapService } from '../skillGap/skillGap.service.js';
import { FailurePredictionService } from '../failurePrediction/failurePrediction.service.js';
import { ExecutionTrackerService } from '../executionTracker/executionTracker.service.js';

export const dashboardRouter = Router();

async function safe<T>(loader: PromiseLike<T>, fallback: T, timeoutMs = 1200): Promise<T> {
  try {
    return await Promise.race([
      Promise.resolve(loader),
      new Promise<T>((resolve) => {
        setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch {
    return fallback;
  }
}

async function fastProfileBundle(userId: string) {
  const profile = await getProfileOrThrow(userId);
  const [roles, skills, certificates, githubProofs, xp] = await Promise.all([
    safe(supabaseAdmin.from('target_roles').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => data ?? []), [], 500),
    safe(supabaseAdmin.from('user_skills').select('*').eq('user_id', userId).order('skill_name').then(({ data }) => data ?? []), [], 500),
    safe(supabaseAdmin.from('certificates').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => data ?? []), [], 500),
    safe(supabaseAdmin.from('github_proofs').select('*').eq('user_id', userId).order('last_synced', { ascending: false }).then(({ data }) => data ?? []), [], 500),
    safe(supabaseAdmin.from('user_xp').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => data ?? null), null, 500),
  ]);

  return {
    profile,
    target_roles: roles,
    skills,
    certificates,
    github_proofs: githubProofs,
    xp,
  };
}

dashboardRouter.get('/dashboard', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const [profile, score, roadmap, benchmark, matches, analysis, risk, consistency] = await Promise.all([
      fastProfileBundle(userId),
      safe(ScoringService.fastCurrent(userId), {
        skillsMatchPercentage: 35,
        projectQualityScore: 20,
        activityConsistencyScore: 15,
        finalScore: 30,
      }),
      safe(RoadmapService.getOrGenerate(userId), null),
      safe(PeerBenchmarkService.getMine(userId), null),
      safe(HireMeService.getMatches(userId), []),
      safe(SkillGapService.latest(userId), null),
      safe(FailurePredictionService.predict(userId), null),
      safe(ExecutionTrackerService.getConsistency(userId), { active_days: 0, consistency_score: 0, graph: [] }),
    ]);

    sendSuccess(res, {
      profile,
      score,
      roadmap,
      benchmark,
      matches: matches.slice(0, 5),
      analysis,
      risk,
      consistency,
    }, 'Dashboard fetched');

    setImmediate(async () => {
      try {
        const latestAnalysis = await SkillGapService.latest(userId);
        const analysisAge = latestAnalysis
          ? Date.now() - new Date(latestAnalysis.created_at).getTime()
          : Infinity;

        if (analysisAge > 24 * 60 * 60 * 1000) {
          await SkillGapService.analyze(userId);
          await ScoringService.recalculate(userId);
          await PeerBenchmarkService.recalculate(userId);
        }

        const cacheKey = `hire-me:matches:${userId}`;
        const cached = isRedisEnabled() ? await redis.get(cacheKey) : null;
        if (!cached) {
          const refreshedMatches = await HireMeService.getTopMatches(userId, 50);
          if (isRedisEnabled()) {
            await redis.set(cacheKey, JSON.stringify(refreshedMatches), 'EX', 21600);
          }
        }
      } catch {
        // Background enrichment must never crash or slow the dashboard response.
      }
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.post('/dashboard/trigger-analysis', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    sendSuccess(res, { queued: true }, 'Analysis queued');

    setImmediate(async () => {
      try {
        await SkillGapService.analyze(userId);
        await ScoringService.recalculate(userId);
        await PeerBenchmarkService.recalculate(userId);
        if (isRedisEnabled()) {
          await redis.del(`hire-me:matches:${userId}`);
          await redis.del(`skill-gap:latest:${userId}`);
        }
      } catch {
        // Silent by design: this endpoint queues enrichment, it does not block it.
      }
    });
  } catch (error) {
    next(error);
  }
});
