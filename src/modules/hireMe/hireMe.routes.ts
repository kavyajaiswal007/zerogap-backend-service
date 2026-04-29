import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { HireMeService } from './hireMe.service.js';

export const hireMeRouter = Router();

hireMeRouter.get('/hire-me/matches', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await HireMeService.getMatches(req.user!.id), 'Job matches fetched');
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
    sendSuccess(res, await HireMeService.recalculateMatches(req.user!.id), 'Job matches refreshed');
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
