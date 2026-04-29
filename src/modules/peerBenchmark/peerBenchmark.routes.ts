import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { sendSuccess } from '../../utils/api.util.js';
import { PeerBenchmarkService } from './peerBenchmark.service.js';

export const peerBenchmarkRouter = Router();

peerBenchmarkRouter.get('/benchmark/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await PeerBenchmarkService.getMine(req.user!.id), 'Benchmark fetched');
  } catch (error) {
    next(error);
  }
});

peerBenchmarkRouter.get('/benchmark/college', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await PeerBenchmarkService.getMine(req.user!.id);
    sendSuccess(res, {
      college_percentile: data.college_percentile,
      avg_college_score: data.avg_college_score,
      ranking_data: data.ranking_data,
    }, 'College benchmark fetched');
  } catch (error) {
    next(error);
  }
});

peerBenchmarkRouter.get('/benchmark/national', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await PeerBenchmarkService.getMine(req.user!.id);
    sendSuccess(res, {
      national_percentile: data.national_percentile,
      avg_national_score: data.avg_national_score,
      ranking_data: data.ranking_data,
    }, 'National benchmark fetched');
  } catch (error) {
    next(error);
  }
});
