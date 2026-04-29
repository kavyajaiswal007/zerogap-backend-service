import { isRedisEnabled, redis } from '../../config/redis.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { getActiveTargetRole, getLatestSkillGapAnalysis, getProfileOrThrow } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';

function percentile(sortedScores: number[], current: number) {
  if (!sortedScores.length) return 0;
  const below = sortedScores.filter((value) => value <= current).length;
  return Number(((below / sortedScores.length) * 100).toFixed(2));
}

export class PeerBenchmarkService {
  static async pendingBenchmark(userId: string) {
    const [profile, targetRole] = await Promise.all([
      getProfileOrThrow(userId),
      getActiveTargetRole(userId),
    ]);

    return {
      id: `pending-${userId}`,
      user_id: userId,
      target_role: targetRole?.job_title ?? 'Target role',
      college_name: profile.college_name,
      college_percentile: 0,
      branch_percentile: 0,
      national_percentile: 0,
      avg_college_score: 0,
      avg_national_score: 0,
      ranking_data: {
        total_role_users: 0,
        total_college_users: 0,
      },
      calculated_at: new Date().toISOString(),
    };
  }

  static async recalculate(userId: string) {
    const [profile, targetRole, analysis] = await Promise.all([
      getProfileOrThrow(userId),
      getActiveTargetRole(userId),
      getLatestSkillGapAnalysis(userId),
    ]);

    if (!targetRole || !analysis) throw new AppError('Benchmark data unavailable', 404, 'BENCHMARK_DATA_MISSING');

    const { data: allRoleUsers } = await supabaseAdmin
      .from('target_roles')
      .select('user_id')
      .eq('job_title', targetRole.job_title)
      .eq('is_active', true);

    const roleUserIds = (allRoleUsers ?? []).map((item) => item.user_id);
    const { data: analyses } = await supabaseAdmin
      .from('skill_gap_analyses')
      .select('user_id, skill_score')
      .in('user_id', roleUserIds);

    const latestByUser = new Map<string, number>();
    for (const item of analyses ?? []) {
      if (!latestByUser.has(item.user_id)) latestByUser.set(item.user_id, item.skill_score ?? 0);
    }
    const nationalScores = [...latestByUser.values()].sort((a, b) => a - b);

    const { data: collegeProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('college_name', profile.college_name ?? '');

    const collegeIds = (collegeProfiles ?? []).map((item) => item.id);
    const collegeScores = [...latestByUser.entries()]
      .filter(([id]) => collegeIds.includes(id))
      .map(([, score]) => score)
      .sort((a, b) => a - b);

    const benchmark = {
      user_id: userId,
      target_role: targetRole.job_title,
      college_name: profile.college_name,
      college_percentile: percentile(collegeScores, analysis.skill_score),
      branch_percentile: percentile(nationalScores, analysis.skill_score),
      national_percentile: percentile(nationalScores, analysis.skill_score),
      avg_college_score: collegeScores.length ? Number((collegeScores.reduce((sum, score) => sum + score, 0) / collegeScores.length).toFixed(2)) : 0,
      avg_national_score: nationalScores.length ? Number((nationalScores.reduce((sum, score) => sum + score, 0) / nationalScores.length).toFixed(2)) : 0,
      ranking_data: {
        total_role_users: nationalScores.length,
        total_college_users: collegeScores.length,
      },
      calculated_at: new Date().toISOString(),
    };

    if (isRedisEnabled()) {
      await redis.zadd(`benchmark:${targetRole.job_title}`, analysis.skill_score, userId);
    }
    const { data, error } = await supabaseAdmin.from('peer_benchmarks').upsert(benchmark, { onConflict: 'user_id' }).select().single();
    if (error) throw new AppError(error.message, 500, 'BENCHMARK_FAILED');
    return data;
  }

  static async getMine(userId: string) {
    const { data } = await supabaseAdmin.from('peer_benchmarks').select('*').eq('user_id', userId).order('calculated_at', { ascending: false }).limit(1).maybeSingle();
    if (data) return data;

    try {
      return await this.recalculate(userId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'BENCHMARK_DATA_MISSING') {
        return this.pendingBenchmark(userId);
      }
      throw error;
    }
  }
}
