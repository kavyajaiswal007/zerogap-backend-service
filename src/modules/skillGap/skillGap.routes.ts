import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { SkillGapService } from './skillGap.service.js';

export const skillGapRouter = Router();

skillGapRouter.post('/skill-gap/analyze', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await SkillGapService.analyze(req.user!.id, req.body.target_role_id), 'Skill gap analysis complete');
  } catch (error) {
    next(error);
  }
});

skillGapRouter.get('/skill-gap/latest', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await SkillGapService.latest(req.user!.id), 'Latest skill gap fetched');
  } catch (error) {
    next(error);
  }
});

skillGapRouter.get('/skill-gap/history', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await SkillGapService.history(req.user!.id), 'Skill gap history fetched');
  } catch (error) {
    next(error);
  }
});

skillGapRouter.get('/skill-gap/missing-skills', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const latest = await SkillGapService.latest(req.user!.id);
    sendSuccess(res, latest?.missing_skills ?? [], 'Missing skills fetched');
  } catch (error) {
    next(error);
  }
});

skillGapRouter.get('/skill-gap/market-skills/:role', requireAuth, async (req, res, next) => {
  try {
    sendSuccess(res, await SkillGapService.getMarketSkills(String(req.params.role)), 'Market skills fetched');
  } catch (error) {
    next(error);
  }
});
