import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/error.util.js';
import { getProfileOrThrow } from '../../utils/db.util.js';

type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  jobTitle?: string;
  job_title?: string;
};

export class AuthService {
  private static async bootstrapUserRows(userId: string, input: RegisterInput) {
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: input.email,
      full_name: input.fullName,
      role: input.role ?? 'student',
      updated_at: new Date().toISOString(),
    });

    await supabaseAdmin.from('user_xp').upsert({
      user_id: userId,
      total_xp: 0,
      current_level: 1,
      current_streak_days: 0,
      longest_streak_days: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    const { data: existingSession } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!existingSession) {
      await supabaseAdmin.from('chat_sessions').insert({
        user_id: userId,
        title: 'Welcome to ZeroGap',
        context_type: 'general',
      });
    }

    const jobTitle = (input.jobTitle ?? input.job_title ?? '').trim();
    if (jobTitle) {
      await supabaseAdmin.from('target_roles').update({ is_active: false }).eq('user_id', userId);
      await supabaseAdmin.from('target_roles').insert({
        user_id: userId,
        job_title: jobTitle,
        experience_level: 'fresher',
        is_active: true,
      });
    }
  }

  static async register(input: RegisterInput) {
    const usingServiceRole = env.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_ANON_KEY;
    let userId: string;
    let session: any;

    if (usingServiceRole) {
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName,
          role: input.role ?? 'student',
        },
      });

      if (createError || !userData.user) {
        const message = createError?.message?.toLowerCase().includes('already')
          ? 'Email already exists'
          : createError?.message ?? 'Unable to register user';
        throw new AppError(message, 400, 'REGISTER_FAILED');
      }

      userId = userData.user.id;

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (sessionError || !sessionData.session) {
        throw new AppError(sessionError?.message ?? 'Account created but sign-in failed', 500, 'SESSION_CREATE_FAILED');
      }

      session = sessionData.session;
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            role: input.role ?? 'student',
          },
        },
      });

      if (error || !data.user) {
        const message = error?.message?.toLowerCase().includes('already')
          ? 'Email already exists'
          : error?.message ?? 'Unable to register user';
        throw new AppError(message, 400, 'REGISTER_FAILED');
      }

      userId = data.user.id;
      session = data.session;
    }

    await this.bootstrapUserRows(userId, input);
    const profile = await getProfileOrThrow(userId);

    return {
      user: profile,
      session,
      isNewUser: true,
    };
  }

  static async login(input: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error || !data.session || !data.user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const profile = await getProfileOrThrow(data.user.id);

    return {
      user: profile,
      session: data.session,
    };
  }

  static async logout(token?: string) {
    if (token) {
      await supabaseAdmin.auth.admin.signOut(token);
    }
    return { loggedOut: true };
  }

  static async refresh(refreshToken: string) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      throw new AppError('Unable to refresh session', 401, 'REFRESH_FAILED');
    }
    const profile = await getProfileOrThrow(data.user.id);
    return { user: profile, session: data.session };
  }

  static async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.FRONTEND_URL}/reset-password`,
    });
    if (error) {
      throw new AppError(error.message, 400, 'FORGOT_PASSWORD_FAILED');
    }
    return { email };
  }

  static async resetPassword(input: { accessToken: string; refreshToken: string; newPassword: string }) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });
    if (sessionError) {
      throw new AppError(sessionError.message, 400, 'RESET_SESSION_FAILED');
    }
    const { data, error } = await supabase.auth.updateUser({
      password: input.newPassword,
    });
    if (error) {
      throw new AppError(error.message, 400, 'RESET_PASSWORD_FAILED');
    }
    return data;
  }

  static async oauthRedirect(provider: 'github' | 'google', redirectTo: string) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error || !data.url) {
      throw new AppError(error?.message ?? 'Unable to start OAuth flow', 400, 'OAUTH_START_FAILED');
    }
    return data.url;
  }

  static async exchangeOAuthCode(code: string) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session || !data.user) {
      throw new AppError(error?.message ?? 'OAuth exchange failed', 400, 'OAUTH_EXCHANGE_FAILED');
    }
    return data;
  }
}
