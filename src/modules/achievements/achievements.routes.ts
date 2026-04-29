import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { sendSuccess } from '../../utils/api.util.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { AchievementsService } from './achievements.service.js';
import { getUserXP } from '../../utils/db.util.js';

export const achievementsRouter = Router();

achievementsRouter.get('/achievements/all', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await AchievementsService.getAllWithStatus(req.user!.id);
    sendSuccess(res, data, 'Achievements fetched');
  } catch (error) {
    next(error);
  }
});

achievementsRouter.get('/achievements/my', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await AchievementsService.getAllWithStatus(req.user!.id);
    sendSuccess(res, data.filter((item) => item.earned), 'Earned achievements fetched');
  } catch (error) {
    next(error);
  }
});

achievementsRouter.get('/xp/stats', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await getUserXP(req.user!.id);
    sendSuccess(res, data, 'XP stats fetched');
  } catch (error) {
    next(error);
  }
});

achievementsRouter.post('/xp/award', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const amount = Number(req.body.amount ?? 0);
    const data = await AchievementsService.awardXP(req.user!.id, amount);
    sendSuccess(res, data, 'XP awarded');
  } catch (error) {
    next(error);
  }
});
