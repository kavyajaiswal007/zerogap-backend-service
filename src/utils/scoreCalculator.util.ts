import { isRedisEnabled, redis } from '../config/redis.js';
import { supabaseAdmin } from '../config/supabase.js';

export interface ScoreBreakdown {
  skillsMatchPercentage: number;
  projectQualityScore: number;
  activityConsistencyScore: number;
  finalScore: number;
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function calculateSkillScore(input: Omit<ScoreBreakdown, 'finalScore'>): ScoreBreakdown {
  const finalScore = clampScore(
    input.skillsMatchPercentage * 0.5 +
      input.projectQualityScore * 0.3 +
      input.activityConsistencyScore * 0.2,
  );

  return {
    ...input,
    skillsMatchPercentage: clampScore(input.skillsMatchPercentage),
    projectQualityScore: clampScore(input.projectQualityScore),
    activityConsistencyScore: clampScore(input.activityConsistencyScore),
    finalScore,
  };
}

export async function cacheScore(userId: string, score: ScoreBreakdown) {
  if (!isRedisEnabled()) return;
  await redis.set(`score:${userId}`, JSON.stringify(score), 'EX', 60 * 60);
}

export async function getCachedScore(userId: string): Promise<ScoreBreakdown | null> {
  if (!isRedisEnabled()) return null;
  const raw = await redis.get(`score:${userId}`);
  return raw ? (JSON.parse(raw) as ScoreBreakdown) : null;
}

export async function publishScoreUpdate(userId: string, score: ScoreBreakdown) {
  await supabaseAdmin.channel(`score:${userId}`).send({
    type: 'broadcast',
    event: 'score.updated',
    payload: score,
  });
}
