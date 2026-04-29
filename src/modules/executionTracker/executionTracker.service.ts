import { supabaseAdmin } from '../../config/supabase.js';
import { AchievementsService } from '../achievements/achievements.service.js';
import { AppError } from '../../utils/error.util.js';

export class ExecutionTrackerService {
  static async logActivity(userId: string, payload: {
    task_id?: string;
    action: string;
    time_spent_minutes?: number;
    output_description?: string;
    proof_url?: string;
    xp_earned?: number;
  }) {
    const { data, error } = await supabaseAdmin.from('execution_logs').insert({
      user_id: userId,
      ...payload,
      date: new Date().toISOString().slice(0, 10),
    }).select().single();

    if (error) {
      throw new AppError(error.message, 500, 'ACTIVITY_LOG_FAILED');
    }

    if (payload.xp_earned && payload.xp_earned > 0) {
      await AchievementsService.awardXP(userId, payload.xp_earned);
    }
    await AchievementsService.updateStreak(userId);
    await AchievementsService.checkAndAward(userId);
    return data;
  }

  static async getToday(userId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin.from('execution_logs').select('*').eq('user_id', userId).eq('date', today).order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  static async getWeekly(userId: string) {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const { data, error } = await supabaseAdmin.from('execution_logs').select('*').eq('user_id', userId).gte('date', start.toISOString().slice(0, 10)).order('date');
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  static async getConsistency(userId: string) {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const { data, error } = await supabaseAdmin
      .from('execution_logs')
      .select('date')
      .eq('user_id', userId)
      .gte('date', start.toISOString().slice(0, 10));

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    const activeDays = new Set((data ?? []).map((item) => item.date)).size;
    return {
      active_days: activeDays,
      consistency_score: Number(((activeDays / 30) * 100).toFixed(2)),
      graph: data ?? [],
    };
  }
}
