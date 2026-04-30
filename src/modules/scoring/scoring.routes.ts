import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { ScoringService } from './scoring.service.js';

export const scoringRouter = Router();

scoringRouter.get('/score/current', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ScoringService.current(req.user!.id), 'Current score fetched');
  } catch (error) {
    next(error);
  }
});

scoringRouter.get('/score/history', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ScoringService.history(req.user!.id), 'Score history fetched');
  } catch (error) {
    next(error);
  }
});

scoringRouter.get('/score/radar', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ScoringService.radar(req.user!.id), 'Radar data fetched');
  } catch (error) {
    next(error);
  }
});

scoringRouter.get('/score/breakdown', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const [score, radar] = await Promise.all([
      ScoringService.current(req.user!.id),
      ScoringService.radar(req.user!.id),
    ]);
    sendSuccess(res, { ...score, radar }, 'Score breakdown fetched');
  } catch (error) {
    next(error);
  }
});

scoringRouter.post('/score/recalculate', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ScoringService.recalculate(req.user!.id), 'Score recalculated');
  } catch (error) {
    next(error);
  }
});
