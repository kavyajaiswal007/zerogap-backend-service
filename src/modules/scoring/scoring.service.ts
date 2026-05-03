import { supabaseAdmin } from '../../config/supabase.js';
import { redis, isRedisEnabled } from '../../config/redis.js';
import { getCachedScore, cacheScore, calculateSkillScore, publishScoreUpdate } from '../../utils/scoreCalculator.util.js';
import { AppError } from '../../utils/error.util.js';
import { ExecutionTrackerService } from '../executionTracker/executionTracker.service.js';

const emptyScore = {
  skillsMatchPercentage: 0,
  projectQualityScore: 0,
  activityConsistencyScore: 0,
  finalScore: 0,
};

export class ScoringService {
  static async recalculate(userId: string) {
    const [{ data: analyses }, { data: proofs }, consistency] = await Promise.all([
      supabaseAdmin.from('skill_gap_analyses').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('github_proofs').select('quality_score').eq('user_id', userId),
      ExecutionTrackerService.getConsistency(userId),
    ]);

    const latestAnalysis = analyses?.[0];
    if (!latestAnalysis) {
      throw new AppError('No skill analysis found to calculate score', 404, 'ANALYSIS_NOT_FOUND');
    }

    const projectQualityScore = proofs?.length
      ? Number((proofs.reduce((sum, item) => sum + Number(item.quality_score ?? 0), 0) / proofs.length).toFixed(2))
      : Number(latestAnalysis.project_quality_score ?? 0);

    const breakdown = calculateSkillScore({
      skillsMatchPercentage: Number(latestAnalysis.skills_match_percentage ?? 0),
      projectQualityScore,
      activityConsistencyScore: consistency.consistency_score,
    });

    await cacheScore(userId, breakdown);
    await publishScoreUpdate(userId, breakdown);

    await supabaseAdmin.from('skill_gap_analyses').update({
      skill_score: breakdown.finalScore,
      project_quality_score: breakdown.projectQualityScore,
      activity_consistency_score: breakdown.activityConsistencyScore,
    }).eq('id', latestAnalysis.id);

    return breakdown;
  }

  static async current(userId: string) {
    const cached = await getCachedScore(userId);
    if (cached) {
      return cached;
    }
    try {
      return await this.recalculate(userId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'ANALYSIS_NOT_FOUND') {
        return emptyScore;
      }
      throw error;
    }
  }

  static async fastCurrent(userId: string) {
    try {
      if (isRedisEnabled()) {
        const cached = await redis.get(`score:${userId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const { data } = await supabaseAdmin
        .from('skill_gap_analyses')
        .select('skill_score, skills_match_percentage, project_quality_score, activity_consistency_score')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        return {
          skillsMatchPercentage: data.skills_match_percentage ?? 0,
          projectQualityScore: data.project_quality_score ?? 0,
          activityConsistencyScore: data.activity_consistency_score ?? 0,
          finalScore: data.skill_score ?? 0,
        };
      }
    } catch {
      // Fast dashboard reads fall back to predicted starter values.
    }

    return {
      skillsMatchPercentage: 35,
      projectQualityScore: 20,
      activityConsistencyScore: 15,
      finalScore: 30,
    };
  }

  static async history(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('skill_gap_analyses')
      .select('id, skill_score, skills_match_percentage, project_quality_score, activity_consistency_score, created_at')
      .eq('user_id', userId)
      .order('created_at');
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  static async radar(userId: string) {
    const { data, error } = await supabaseAdmin.from('user_skills').select('skill_name, proficiency_level').eq('user_id', userId);
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    return (data ?? []).map((item) => ({
      skill: item.skill_name,
      score: item.proficiency_level,
      category: item.skill_name.includes('React') || item.skill_name.includes('CSS') ? 'Frontend' : 'Core',
    }));
  }
}
