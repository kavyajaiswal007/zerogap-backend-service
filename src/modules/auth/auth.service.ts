import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/error.util.js';
import { getProfileOrThrow } from '../../utils/db.util.js';
import { randomBytes } from 'crypto';

type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  jobTitle?: string;
  job_title?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  id?: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
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

  static googleOAuthRedirect(redirectTo: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth is not configured', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectTo);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  private static async findAuthUserByEmail(email: string) {
    const normalized = email.toLowerCase();

    for (let page = 1; page <= 5; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        throw new AppError(error.message, 500, 'AUTH_USER_LOOKUP_FAILED');
      }

      const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
      if (found) return found;
      if (data.users.length < 1000) return null;
    }

    return null;
  }

  static async completeGoogleOAuth(code: string, redirectTo: string) {
    if (!code) {
      throw new AppError('Missing Google authorization code', 400, 'GOOGLE_CODE_MISSING');
    }

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth is not configured', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectTo,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokenJson.access_token) {
      throw new AppError(tokenJson.error_description ?? tokenJson.error ?? 'Google token exchange failed', 400, 'GOOGLE_TOKEN_EXCHANGE_FAILED');
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/json',
      },
    });

    const googleUser = await userInfoResponse.json() as GoogleUserInfo;
    if (!userInfoResponse.ok || !googleUser.email) {
      throw new AppError('Unable to read Google profile email', 400, 'GOOGLE_PROFILE_FAILED');
    }

    const email = googleUser.email.toLowerCase();
    const fullName = googleUser.name ?? email.split('@')[0];
    const password = `${randomBytes(32).toString('base64url')}Aa1!`;
    const existingUser = await this.findAuthUserByEmail(email);
    let userId = existingUser?.id;
    const isNewUser = !existingUser;

    if (existingUser) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: fullName,
          name: fullName,
          avatar_url: googleUser.picture,
          picture: googleUser.picture,
          provider: 'google',
          google_id: googleUser.id,
        },
      });

      if (error) {
        throw new AppError(error.message, 500, 'GOOGLE_USER_UPDATE_FAILED');
      }
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          name: fullName,
          avatar_url: googleUser.picture,
          picture: googleUser.picture,
          provider: 'google',
          google_id: googleUser.id,
        },
      });

      if (error || !data.user) {
        throw new AppError(error?.message ?? 'Unable to create Google user', 500, 'GOOGLE_USER_CREATE_FAILED');
      }

      userId = data.user.id;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session || !sessionData.user) {
      throw new AppError(sessionError?.message ?? 'Unable to create Google session', 500, 'GOOGLE_SESSION_FAILED');
    }

    await this.bootstrapUserRows(userId ?? sessionData.user.id, {
      email,
      password,
      fullName,
      role: 'student',
    });

    await supabaseAdmin
      .from('profiles')
      .update({
        avatar_url: googleUser.picture ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId ?? sessionData.user.id);

    const profile = await getProfileOrThrow(userId ?? sessionData.user.id);

    return {
      user: profile,
      session: sessionData.session,
      isNewUser,
    };
  }

  static async exchangeOAuthCode(code: string) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session || !data.user) {
      throw new AppError(error?.message ?? 'OAuth exchange failed', 400, 'OAUTH_EXCHANGE_FAILED');
    }
    return data;
  }
}
