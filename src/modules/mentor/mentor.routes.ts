import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { buildResponse, sendSuccess } from '../../utils/api.util.js';
import { MentorService } from './mentor.service.js';

export const mentorRouter = Router();

mentorRouter.post('/mentor/chat', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reply = await MentorService.chat(req.user!.id, req.body.session_id, req.body.message);
    res.write(`data: ${JSON.stringify(buildResponse(true, { content: reply }, 'Mentor response streamed'))}\n\n`);
    res.write('event: done\ndata: {"done":true}\n\n');
    res.end();
  } catch (error) {
    next(error);
  }
});

mentorRouter.get('/mentor/sessions', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await MentorService.listSessions(req.user!.id), 'Mentor sessions fetched');
  } catch (error) {
    next(error);
  }
});

mentorRouter.post('/mentor/sessions', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await MentorService.createSession(req.user!.id, req.body.title, req.body.context_type), 'Mentor session created', 201);
  } catch (error) {
    next(error);
  }
});

mentorRouter.get('/mentor/sessions/:id/messages', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await MentorService.getMessages(req.user!.id, String(req.params.id)), 'Mentor messages fetched');
  } catch (error) {
    next(error);
  }
});

mentorRouter.delete('/mentor/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await MentorService.deleteSession(req.user!.id, String(req.params.id)), 'Mentor session deleted');
  } catch (error) {
    next(error);
  }
});
