import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './error.util.js';

export async function getProfileOrThrow(userId: string) {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR');
  }
  if (!data) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }
  return data;
}

export async function getActiveTargetRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('target_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR');
  }
  return data;
}

export async function getUserSkills(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_skills')
    .select('*')
    .eq('user_id', userId)
    .order('skill_name');

  if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR');
  }
  return data ?? [];
}

export async function getLatestSkillGapAnalysis(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('skill_gap_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR');
  }

  return data;
}

export async function getUserXP(userId: string) {
  const { data, error } = await supabaseAdmin.from('user_xp').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR');
  }
  return data;
}

export async function upsertUserXP(userId: string, totalXp: number) {
  const currentLevel = Math.floor(totalXp / 500) + 1;
  const { data, error } = await supabaseAdmin
    .from('user_xp')
    .upsert({
      user_id: userId,
      total_xp: totalXp,
      current_level: currentLevel,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR');
  }

  return data;
}
