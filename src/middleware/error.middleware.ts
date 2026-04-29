import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { buildResponse } from '../utils/api.util.js';
import { AppError } from '../utils/error.util.js';
import { logger } from '../utils/logger.util.js';

export function notFoundMiddleware(_req: Request, res: Response) {
  res.status(404).json(buildResponse(false, null, 'Route not found', 'NOT_FOUND'));
}

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const appError = err instanceof AppError ? err : new AppError(err.message || 'Internal server error', 500, 'INTERNAL_ERROR');

  logger.error({
    message: appError.message,
    code: appError.code,
    stack: err.stack,
  });

  res.status(appError.statusCode).json({
    success: false,
    data: null,
    message: appError.message,
    error: appError.code,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      ...(env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
    },
  });
}
