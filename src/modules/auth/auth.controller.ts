import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess } from '../../utils/api.util.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { getProfileOrThrow } from '../../utils/db.util.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';

function getBackendBase(req: Request) {
  return `${req.protocol}://${req.get('host')}`;
}

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.register(req.body);
      sendSuccess(res, data, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.login(req.body);
      sendSuccess(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.logout(req.token);
      sendSuccess(res, data, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.refresh(req.body.refreshToken);
      sendSuccess(res, data, 'Session refreshed');
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.forgotPassword(req.body.email);
      sendSuccess(res, data, 'Password reset email sent');
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.resetPassword(req.body);
      sendSuccess(res, data, 'Password reset successful');
    } catch (error) {
      next(error);
    }
  }

  static async github(req: Request, res: Response, next: NextFunction) {
    try {
      const url = await AuthService.oauthRedirect('github', `${getBackendBase(req)}/api/auth/github/callback`);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  static async google(req: Request, res: Response, next: NextFunction) {
    try {
      const url = await AuthService.oauthRedirect('google', `${getBackendBase(req)}/api/auth/google/callback`);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  static async githubCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.query.code ?? '');
      const data = await AuthService.exchangeOAuthCode(code);
      const username = String(
        data.user.user_metadata.user_name ??
          data.user.user_metadata.preferred_username ??
          '',
      );

      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata.full_name ?? data.user.user_metadata.name,
        avatar_url: data.user.user_metadata.avatar_url,
        github_username: username || null,
      });

      res.redirect(`${env.FRONTEND_URL}?access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}`);
    } catch (error) {
      next(error);
    }
  }

  static async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.query.code ?? '');
      const data = await AuthService.exchangeOAuthCode(code);

      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata.full_name ?? data.user.user_metadata.name,
        avatar_url: data.user.user_metadata.avatar_url,
      });

      res.redirect(`${env.FRONTEND_URL}?access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}`);
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const profile = await getProfileOrThrow(req.user!.id);
      sendSuccess(res, profile, 'Current user profile');
    } catch (error) {
      next(error);
    }
  }
}
