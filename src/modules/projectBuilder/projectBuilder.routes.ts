import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { ProjectBuilderService } from './projectBuilder.service.js';

export const projectBuilderRouter = Router();

projectBuilderRouter.post('/projects/generate', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProjectBuilderService.generate(req.user!.id, req.body.difficulty), 'Project generated', 201);
  } catch (error) {
    next(error);
  }
});

projectBuilderRouter.get('/projects/suggestions', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProjectBuilderService.suggestions(req.user!.id), 'Project suggestions fetched');
  } catch (error) {
    next(error);
  }
});

projectBuilderRouter.get('/projects/my', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProjectBuilderService.mine(req.user!.id), 'Generated projects fetched');
  } catch (error) {
    next(error);
  }
});
