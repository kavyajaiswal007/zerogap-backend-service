import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { sendSuccess } from '../../utils/api.util.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { ExecutionTrackerService } from './executionTracker.service.js';
import { getUserXP } from '../../utils/db.util.js';

const logSchema = z.object({
  task_id: z.string().uuid().optional(),
  action: z.preprocess((value) => {
    const action = String(value ?? '').trim();
    return action.length >= 2 ? action : 'Completed a focused portfolio sprint';
  }, z.string().min(2)),
  time_spent_minutes: z.preprocess((value) => {
    const next = Number(value);
    return Number.isFinite(next) ? Math.max(0, Math.round(next)) : 45;
  }, z.number().int().nonnegative()).optional(),
  output_description: z.string().optional(),
  proof_url: z.preprocess((value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      return parsed.hostname.includes('.') ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  }, z.string().url().optional()).catch(undefined),
  xp_earned: z.preprocess((value) => {
    const next = Number(value);
    return Number.isFinite(next) ? Math.max(0, Math.round(next)) : 25;
  }, z.number().int().nonnegative()).optional(),
});

export const executionTrackerRouter = Router();

executionTrackerRouter.post('/tracker/log', requireAuth, validate(logSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await ExecutionTrackerService.logActivity(req.user!.id, req.body);
    sendSuccess(res, data, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
});

executionTrackerRouter.get('/tracker/today', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ExecutionTrackerService.getToday(req.user!.id), 'Today activity fetched');
  } catch (error) {
    next(error);
  }
});

executionTrackerRouter.get('/tracker/weekly', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ExecutionTrackerService.getWeekly(req.user!.id), 'Weekly activity fetched');
  } catch (error) {
    next(error);
  }
});

executionTrackerRouter.get('/tracker/streak', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await getUserXP(req.user!.id), 'Streak fetched');
  } catch (error) {
    next(error);
  }
});

executionTrackerRouter.get('/tracker/consistency', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ExecutionTrackerService.getConsistency(req.user!.id), 'Consistency fetched');
  } catch (error) {
    next(error);
  }
});
