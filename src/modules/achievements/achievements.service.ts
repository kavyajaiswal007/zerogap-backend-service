import { supabaseAdmin } from '../../config/supabase.js';
import { getLatestSkillGapAnalysis, getUserXP } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';

const ACHIEVEMENTS = [
  { name: 'First Step', description: 'Complete your first task', xp_reward: 100, condition_type: 'task_count', condition_value: { min: 1 } },
  { name: 'Skill Seeker', description: 'Add 5 verified skills', xp_reward: 150, condition_type: 'verified_skills', condition_value: { min: 5 } },
  { name: 'Proof Master', description: 'Analyze 5 GitHub repos', xp_reward: 200, condition_type: 'proof_count', condition_value: { min: 5 } },
  { name: 'Consistent', description: 'Maintain a 7-day streak', xp_reward: 250, condition_type: 'streak_days', condition_value: { min: 7 } },
  { name: 'On Fire', description: 'Maintain a 30-day streak', xp_reward: 400, condition_type: 'streak_days', condition_value: { min: 30 } },
  { name: 'Rising Star', description: 'Reach skill score 50', xp_reward: 250, condition_type: 'skill_score', condition_value: { min: 50 } },
  { name: 'Job Ready', description: 'Reach skill score 80', xp_reward: 500, condition_type: 'skill_score', condition_value: { min: 80 } },
  { name: 'Roadmap Warrior', description: 'Complete all roadmap stages', xp_reward: 300, condition_type: 'roadmap_completion', condition_value: { min: 100 } },
  { name: 'Interview Ready', description: 'Generate ATS resume and reach score 75', xp_reward: 350, condition_type: 'resume_and_score', condition_value: { min: 75 } },
];

export class AchievementsService {
  static async ensureSeeded() {
    const { error } = await supabaseAdmin.from('achievements').upsert(ACHIEVEMENTS, { onConflict: 'name' });
    if (error) {
      throw new AppError(error.message, 500, 'ACHIEVEMENT_SEED_FAILED');
    }
  }

  static async awardXP(userId: string, amount: number) {
    const current = await getUserXP(userId);
    const totalXp = (current?.total_xp ?? 0) + amount;
    const streak = current?.current_streak_days ?? 0;
    const level = Math.floor(totalXp / 500) + 1;

    const { data, error } = await supabaseAdmin.from('user_xp').upsert({
      user_id: userId,
      total_xp: totalXp,
      current_level: level,
      current_streak_days: streak,
      longest_streak_days: Math.max(streak, current?.longest_streak_days ?? 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single();

    if (error) {
      throw new AppError(error.message, 500, 'XP_AWARD_FAILED');
    }
    return data;
  }

  static async updateStreak(userId: string, activeDate = new Date()) {
    const xp = await getUserXP(userId);
    const today = activeDate.toISOString().slice(0, 10);
    const yesterday = new Date(activeDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lastActive = xp?.last_active_date;

    let streak = xp?.current_streak_days ?? 0;
    if (lastActive === today) {
      return xp;
    }
    streak = lastActive === yesterday ? streak + 1 : 1;

    const { data, error } = await supabaseAdmin.from('user_xp').upsert({
      user_id: userId,
      total_xp: xp?.total_xp ?? 0,
      current_level: xp?.current_level ?? 1,
      current_streak_days: streak,
      longest_streak_days: Math.max(streak, xp?.longest_streak_days ?? 0),
      last_active_date: today,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single();

    if (error) {
      throw new AppError(error.message, 500, 'STREAK_UPDATE_FAILED');
    }
    return data;
  }

  static async checkAndAward(userId: string) {
    await this.ensureSeeded();

    const [
      { data: verifiedSkills },
      { data: proofs },
      { data: completedTasks },
      { data: activeRoadmaps },
      { data: resumes },
      { data: existingAwards },
      xp,
      latestAnalysis,
    ] = await Promise.all([
      supabaseAdmin.from('user_skills').select('id', { count: 'exact' }).eq('user_id', userId).eq('verified', true),
      supabaseAdmin.from('github_proofs').select('id', { count: 'exact' }).eq('user_id', userId),
      supabaseAdmin.from('roadmap_tasks').select('id', { count: 'exact' }).eq('user_id', userId).eq('is_completed', true),
      supabaseAdmin.from('roadmaps').select('completion_percentage').eq('user_id', userId).eq('is_active', true),
      supabaseAdmin.from('resumes').select('id').eq('user_id', userId),
      supabaseAdmin.from('user_achievements').select('achievement_id, achievements(name)').eq('user_id', userId),
      getUserXP(userId),
      getLatestSkillGapAnalysis(userId),
    ]);

    const earnedNames = new Set(
      (existingAwards ?? [])
        .map((item: any) => item.achievements?.name)
        .filter(Boolean),
    );

    const score = latestAnalysis?.skill_score ?? 0;
    const roadmapCompletion = Math.max(...((activeRoadmaps ?? []).map((item: any) => item.completion_percentage ?? 0)), 0);
    const streak = xp?.current_streak_days ?? 0;

    const unlocked = ACHIEVEMENTS.filter((achievement) => {
      if (earnedNames.has(achievement.name)) {
        return false;
      }

      switch (achievement.condition_type) {
        case 'task_count':
          return (completedTasks?.length ?? 0) >= achievement.condition_value.min;
        case 'verified_skills':
          return (verifiedSkills?.length ?? 0) >= achievement.condition_value.min;
        case 'proof_count':
          return (proofs?.length ?? 0) >= achievement.condition_value.min;
        case 'streak_days':
          return streak >= achievement.condition_value.min;
        case 'skill_score':
          return score >= achievement.condition_value.min;
        case 'roadmap_completion':
          return roadmapCompletion >= achievement.condition_value.min;
        case 'resume_and_score':
          return (resumes?.length ?? 0) > 0 && score >= achievement.condition_value.min;
        default:
          return false;
      }
    });

    if (!unlocked.length) {
      return [];
    }

    const { data: achievementRows } = await supabaseAdmin
      .from('achievements')
      .select('id, name, xp_reward')
      .in('name', unlocked.map((item) => item.name));

    const rows = achievementRows ?? [];
    if (rows.length) {
      await supabaseAdmin.from('user_achievements').upsert(
        rows.map((achievement) => ({
          user_id: userId,
          achievement_id: achievement.id,
        })),
        { onConflict: 'user_id,achievement_id' },
      );

      const bonus = rows.reduce((sum, item) => sum + (item.xp_reward ?? 0), 0);
      if (bonus > 0) {
        await this.awardXP(userId, bonus);
      }
    }

    return rows;
  }

  static async getAllWithStatus(userId: string) {
    await this.ensureSeeded();
    const [{ data: all }, { data: mine }] = await Promise.all([
      supabaseAdmin.from('achievements').select('*').order('name'),
      supabaseAdmin.from('user_achievements').select('achievement_id').eq('user_id', userId),
    ]);
    const mineIds = new Set((mine ?? []).map((item: any) => item.achievement_id));
    return (all ?? []).map((achievement: any) => ({
      ...achievement,
      earned: mineIds.has(achievement.id),
    }));
  }
}
