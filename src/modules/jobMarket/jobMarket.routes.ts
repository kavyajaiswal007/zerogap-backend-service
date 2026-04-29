import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { JobMarketService } from './jobMarket.service.js';

export const jobMarketRouter = Router();

jobMarketRouter.get('/jobs/market/:role', requireAuth, async (req, res, next) => {
  try {
    sendSuccess(res, await JobMarketService.marketForRole(String(req.params.role)), 'Market data fetched');
  } catch (error) {
    next(error);
  }
});

jobMarketRouter.get('/jobs/listings', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await JobMarketService.getListings({
      role: req.query.role as string | undefined,
      location: req.query.location as string | undefined,
      userId: req.user!.id,
    }), 'Job listings fetched');
  } catch (error) {
    next(error);
  }
});

jobMarketRouter.get('/jobs/trending-skills', requireAuth, async (req, res, next) => {
  try {
    const role = String(req.query.role ?? 'Software Engineer');
    const data = await JobMarketService.marketForRole(role);
    sendSuccess(res, data.cache?.top_skills ?? [], 'Trending skills fetched');
  } catch (error) {
    next(error);
  }
});

jobMarketRouter.post('/jobs/refresh', requireAuth, aiRateLimiter, async (req, res, next) => {
  try {
    const role = String(req.body.role ?? 'Software Engineer');
    sendSuccess(res, await JobMarketService.refreshRole(role), 'Job market refreshed');
  } catch (error) {
    next(error);
  }
});
