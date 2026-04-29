import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/error.util.js';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(result.error.issues.map((issue) => issue.message).join(', '), 422, 'VALIDATION_ERROR'));
    }

    req[source] = result.data;
    return next();
  };
}
