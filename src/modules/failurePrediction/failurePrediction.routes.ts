import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { FailurePredictionService } from './failurePrediction.service.js';

export const failurePredictionRouter = Router();

failurePredictionRouter.get('/predict/risk', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await FailurePredictionService.predict(req.user!.id), 'Risk prediction generated');
  } catch (error) {
    next(error);
  }
});

failurePredictionRouter.get('/predict/ready-date', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await FailurePredictionService.predict(req.user!.id);
    sendSuccess(res, { ready_in_months: data.ready_in_months, success_probability: data.success_probability }, 'Ready-date prediction generated');
  } catch (error) {
    next(error);
  }
});
