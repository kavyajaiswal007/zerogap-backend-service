import type { Response } from 'express';
import type { ApiResponse } from '../types/index.js';

const VERSION = '1.0';

export function buildResponse<T>(
  success: boolean,
  data: T | null,
  message: string,
  error: string | null = null,
): ApiResponse<T> {
  return {
    success,
    data,
    message,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      version: VERSION,
    },
  };
}

export function sendSuccess<T>(res: Response, data: T, message = 'OK', status = 200) {
  return res.status(status).json(buildResponse(true, data, message));
}

export function sendError(res: Response, message: string, status = 400, code?: string) {
  return res.status(status).json(
    buildResponse(false, null, message, code ?? message),
  );
}
