import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { ProofAnalyzerService } from './proofAnalyzer.service.js';

export const proofAnalyzerRouter = Router();

proofAnalyzerRouter.post('/proof/analyze-github', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProofAnalyzerService.analyzeGithub(req.user!.id), 'GitHub proof analyzed');
  } catch (error) {
    next(error);
  }
});

proofAnalyzerRouter.post('/proof/analyze-certificate', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProofAnalyzerService.analyzeCertificate(req.user!.id, req.body), 'Certificate analyzed');
  } catch (error) {
    next(error);
  }
});

proofAnalyzerRouter.get('/proof/score', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProofAnalyzerService.getProofScore(req.user!.id), 'Proof score fetched');
  } catch (error) {
    next(error);
  }
});
