import type { NextFunction, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/error.util.js';

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid Authorization header', 401, 'UNAUTHORIZED');
    }

    const token = authorization.replace('Bearer ', '').trim();
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: String(data.user.user_metadata?.role ?? 'student'),
    };
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role ?? 'student')) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    return next();
  };
}
