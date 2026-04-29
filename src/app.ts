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

const allowedOrigins = new Set([
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
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

app.get('/health', (_req, res) => {
  res.status(200).json(buildResponse(true, { status: 'ok' }, 'Service healthy'));
});

app.get('/', (_req, res) => {
  res
    .status(200)
    .type('html')
    .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZeroGap Backend</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }
    main {
      width: min(560px, calc(100vw - 32px));
      padding: 32px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.72);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 24px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      color: #86efac;
      font-weight: 600;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.14);
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    a {
      color: #bfdbfe;
      text-decoration: none;
      border: 1px solid rgba(191, 219, 254, 0.35);
      border-radius: 6px;
      padding: 10px 14px;
    }
    a:hover {
      background: rgba(191, 219, 254, 0.12);
    }
  </style>
</head>
<body>
  <main>
    <div class="status"><span class="dot"></span>Running</div>
    <h1>ZeroGap Backend</h1>
    <p>The API is deployed and healthy. Use the health endpoint for checks, or open the API docs for available routes.</p>
    <nav>
      <a href="/health">Health</a>
      <a href="/api/docs/">API Docs</a>
    </nav>
  </main>
</body>
</html>`);
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
