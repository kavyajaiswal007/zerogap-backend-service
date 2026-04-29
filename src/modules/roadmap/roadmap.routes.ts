import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { RoadmapService } from './roadmap.service.js';

export const roadmapRouter = Router();

roadmapRouter.post('/roadmap/generate', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await RoadmapService.generate(req.user!.id), 'Roadmap generated', 201);
  } catch (error) {
    next(error);
  }
});

roadmapRouter.get('/roadmap/active', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await RoadmapService.getActive(req.user!.id), 'Active roadmap fetched');
  } catch (error) {
    next(error);
  }
});

roadmapRouter.get('/roadmap/progress', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await RoadmapService.progress(req.user!.id), 'Roadmap progress fetched');
  } catch (error) {
    next(error);
  }
});

roadmapRouter.get('/roadmap/:id', requireAuth, async (req, res, next) => {
  try {
    sendSuccess(res, await RoadmapService.getRoadmap(String(req.params.id)), 'Roadmap fetched');
  } catch (error) {
    next(error);
  }
});

roadmapRouter.put('/roadmap/:id/stage/:stageId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await RoadmapService.updateStage(req.user!.id, String(req.params.id), String(req.params.stageId), Number(req.body.completion_percentage ?? 0)), 'Stage updated');
  } catch (error) {
    next(error);
  }
});

roadmapRouter.put('/roadmap/task/:taskId/complete', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await RoadmapService.completeTask(req.user!.id, String(req.params.taskId)), 'Task completed');
  } catch (error) {
    next(error);
  }
});
