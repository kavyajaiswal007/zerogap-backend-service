import { Router } from 'express';
import { redis, isRedisEnabled } from '../../config/redis.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { HireMeService } from './hireMe.service.js';

export const hireMeRouter = Router();

hireMeRouter.get('/hire-me/matches', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const cacheKey = `hire-me:matches:${userId}`;

    if (isRedisEnabled()) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        sendSuccess(res, JSON.parse(cached), 'Job matches loaded');
        return;
      }
    }

    const matches = await HireMeService.getTopMatches(userId, 50);

    if (isRedisEnabled()) {
      await redis.set(cacheKey, JSON.stringify(matches), 'EX', 1800);
    }

    sendSuccess(res, matches, `${matches.length} job matches found`);
  } catch (error) {
    next(error);
  }
});

hireMeRouter.get('/hire-me/match/:jobId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await HireMeService.getMatch(req.user!.id, String(req.params.jobId)), 'Job match fetched');
  } catch (error) {
    next(error);
  }
});

hireMeRouter.post('/hire-me/refresh-matches', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const cacheKey = `hire-me:matches:${userId}`;

    if (isRedisEnabled()) {
      await redis.del(cacheKey);
    }

    const matches = await HireMeService.getTopMatches(userId, 50, true);

    if (isRedisEnabled()) {
      await redis.set(cacheKey, JSON.stringify(matches), 'EX', 1800);
    }

    sendSuccess(res, matches, `Refreshed - ${matches.length} matches found`);
  } catch (error) {
    next(error);
  }
});

hireMeRouter.put('/hire-me/match/:id/save', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await HireMeService.updateSaved(req.user!.id, String(req.params.id), Boolean(req.body.saved ?? true)), 'Match saved state updated');
  } catch (error) {
    next(error);
  }
});

hireMeRouter.put('/hire-me/match/:id/apply', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await HireMeService.updateApplied(req.user!.id, String(req.params.id)), 'Match marked as applied');
  } catch (error) {
    next(error);
  }
});
