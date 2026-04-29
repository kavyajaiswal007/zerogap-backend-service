import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { ResumeService } from './resume.service.js';
import { enqueueResumePdf } from '../../queues/resumeGeneration.queue.js';

export const resumeRouter = Router();

resumeRouter.post('/resume/generate', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const resume = await ResumeService.generate(req.user!.id);
    await enqueueResumePdf(req.user!.id, resume.id);
    sendSuccess(res, resume, 'Resume generated', 201);
  } catch (error) {
    next(error);
  }
});

resumeRouter.get('/resume/latest', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ResumeService.latest(req.user!.id), 'Latest resume fetched');
  } catch (error) {
    next(error);
  }
});

resumeRouter.get('/resume/ats-score', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const latest = await ResumeService.latest(req.user!.id);
    sendSuccess(res, latest ? { ats_score: latest.ats_score, keyword_match_score: latest.keyword_match_score } : null, 'ATS score fetched');
  } catch (error) {
    next(error);
  }
});

resumeRouter.get('/resume/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ResumeService.getById(req.user!.id, String(req.params.id)), 'Resume fetched');
  } catch (error) {
    next(error);
  }
});

resumeRouter.post('/resume/:id/export-pdf', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ResumeService.exportPdf(req.user!.id, String(req.params.id)), 'Resume PDF exported');
  } catch (error) {
    next(error);
  }
});
