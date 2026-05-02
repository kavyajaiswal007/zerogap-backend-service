import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { authRateLimiter, generalRateLimiter } from './middleware/rateLimit.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { httpLogger } from './middleware/logger.middleware.js';
import { buildResponse } from './utils/api.util.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { skillGapRouter } from './modules/skillGap/skillGap.routes.js';
import { scoringRouter } from './modules/scoring/scoring.routes.js';
import { roadmapRouter } from './modules/roadmap/roadmap.routes.js';
import { resumeRouter } from './modules/resume/resume.routes.js';
import { mentorRouter } from './modules/mentor/mentor.routes.js';
import { jobMarketRouter } from './modules/jobMarket/jobMarket.routes.js';
import { proofAnalyzerRouter } from './modules/proofAnalyzer/proofAnalyzer.routes.js';
import { hireMeRouter } from './modules/hireMe/hireMe.routes.js';
import { peerBenchmarkRouter } from './modules/peerBenchmark/peerBenchmark.routes.js';
import { executionTrackerRouter } from './modules/executionTracker/executionTracker.routes.js';
import { achievementsRouter } from './modules/achievements/achievements.routes.js';
import { failurePredictionRouter } from './modules/failurePrediction/failurePrediction.routes.js';
import { projectBuilderRouter } from './modules/projectBuilder/projectBuilder.routes.js';
import { collegePanelRouter } from './modules/collegePanel/collegePanel.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ZeroGap Backend API',
      version: '1.0.0',
      description: 'Backend APIs for ZeroGap Smart Mentoring platform',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.ts'],
});

export const app = express();

// Render and Vercel sit behind proxies. Trust the first proxy so rate limiting
// keys use the real client IP instead of grouping all users behind one proxy.
app.set('trust proxy', 1);

const allowedOrigins = new Set([
  env.FRONTEND_URL,
  'https://myzerogap.vercel.app',
  'https://zerogap-frontend-002.vercel.app',
  'https://zerogap-frontend-002-kavya-jaiswals-projects.vercel.app',
  'https://zerogap-frontend-002-kavyajaiswal007-kavya-jaiswals-projects.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app') && hostname.startsWith('zerogap-frontend-002');
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(httpLogger);

app.get('/health', async (_req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'checking',
      redis: 'checking',
      ai: 'ok',
    },
  };

  try {
    const { error } = await import('./config/supabase.js').then(({ supabaseAdmin }) =>
      supabaseAdmin.from('profiles').select('id').limit(1),
    );
    checks.services.database = error ? 'error' : 'ok';
  } catch {
    checks.services.database = 'error';
  }

  try {
    const { redis, isRedisEnabled } = await import('./config/redis.js');
    checks.services.redis = isRedisEnabled() ? await redis.ping() : 'degraded';
    if (checks.services.redis === 'PONG') checks.services.redis = 'ok';
  } catch {
    checks.services.redis = 'degraded';
  }

  res.status(checks.services.database === 'ok' ? 200 : 503).json(checks);
});

app.get('/', (_req, res) => {
  res.redirect(302, env.FRONTEND_URL);
});

app.use('/api/docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  const spec = {
    ...swaggerSpec,
    servers: [{ url: `${req.protocol}://${req.get('host')}` }],
  };
  return swaggerUi.setup(spec)(req, res, next);
});
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api', generalRateLimiter);
app.use('/api', dashboardRouter);
app.use('/api', profileRouter);
app.use('/api', skillGapRouter);
app.use('/api', scoringRouter);
app.use('/api', roadmapRouter);
app.use('/api', resumeRouter);
app.use('/api', mentorRouter);
app.use('/api', jobMarketRouter);
app.use('/api', proofAnalyzerRouter);
app.use('/api', hireMeRouter);
app.use('/api', peerBenchmarkRouter);
app.use('/api', executionTrackerRouter);
app.use('/api', achievementsRouter);
app.use('/api', failurePredictionRouter);
app.use('/api', projectBuilderRouter);
app.use('/api', collegePanelRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
