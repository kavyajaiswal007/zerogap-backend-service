import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { CollegePanelService } from './collegePanel.service.js';

export const collegePanelRouter = Router();

collegePanelRouter.use(requireAuth, requireRole(['college', 'admin']));

collegePanelRouter.get('/college/dashboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await CollegePanelService.dashboard(req.user!.id), 'College dashboard fetched');
  } catch (error) {
    next(error);
  }
});

collegePanelRouter.get('/college/students', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await CollegePanelService.students(req.user!.id), 'College students fetched');
  } catch (error) {
    next(error);
  }
});

collegePanelRouter.get('/college/placement-readiness', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await CollegePanelService.placementReadiness(req.user!.id), 'Placement readiness fetched');
  } catch (error) {
    next(error);
  }
});

collegePanelRouter.get('/college/skill-heatmap', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await CollegePanelService.skillHeatmap(req.user!.id), 'Skill heatmap fetched');
  } catch (error) {
    next(error);
  }
});

collegePanelRouter.get('/college/training-recommendations', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await CollegePanelService.trainingRecommendations(req.user!.id), 'Training recommendations fetched');
  } catch (error) {
    next(error);
  }
});
