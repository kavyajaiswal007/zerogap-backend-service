import { Router } from 'express';
import { redis, isRedisEnabled } from '../../config/redis.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { JobMarketService } from './jobMarket.service.js';

export const jobMarketRouter = Router();

jobMarketRouter.get('/job-market/live', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { data: roleRow } = await supabaseAdmin
      .from('target_roles')
      .select('job_title')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    const role = roleRow?.job_title ?? 'Full Stack Developer';
    const cacheKey = `job-market:live:${role.toLowerCase().replace(/\s+/g, '-')}`;

    if (isRedisEnabled()) {
      const hit = await redis.get(cacheKey);
      if (hit) {
        sendSuccess(res, JSON.parse(hit), 'cached');
        return;
      }
    }

    try {
      await JobMarketService.refreshRole(role);
    } catch {
      // JSearch can fail; the dashboard still falls back to cached DB rows.
    }

    const { data: dbListings } = await supabaseAdmin
      .from('job_listings')
      .select('*')
      .ilike('title', `%${role.split(' ')[0]}%`)
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
      .limit(30);

    const listings = dbListings ?? [];
    if (isRedisEnabled() && listings.length) {
      await redis.set(cacheKey, JSON.stringify(listings), 'EX', 21600);
    }

    sendSuccess(res, listings, `${listings.length} listings`);
  } catch (error) {
    next(error);
  }
});

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
