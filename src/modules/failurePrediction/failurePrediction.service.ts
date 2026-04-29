import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getLatestSkillGapAnalysis, getProfileOrThrow } from '../../utils/db.util.js';
import { ExecutionTrackerService } from '../executionTracker/executionTracker.service.js';
import { AppError } from '../../utils/error.util.js';

function logistic(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export class FailurePredictionService {
  static async predict(userId: string) {
    const [profile, analysis, consistency] = await Promise.all([
      getProfileOrThrow(userId),
      getLatestSkillGapAnalysis(userId),
      ExecutionTrackerService.getConsistency(userId),
    ]);

    if (!analysis) throw new AppError('Skill analysis required before prediction', 404, 'ANALYSIS_REQUIRED');

    const missingSkills = (analysis.missing_skills ?? []).length;
    const score = Number(analysis.skill_score ?? 0);
    const pacePerWeek = Math.max(1, consistency.consistency_score / 12);
    const pointsNeeded = Math.max(0, 80 - score);
    const readyInWeeks = Math.ceil(pointsNeeded / pacePerWeek);
    const readyInMonths = Math.ceil(readyInWeeks / 4);

    const graduationMonths = profile.graduation_year
      ? Math.max(0, (profile.graduation_year - new Date().getFullYear()) * 12)
      : 12;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (score < 60 && graduationMonths < 3) riskLevel = 'high';
    else if (graduationMonths < 6 || consistency.consistency_score < 35) riskLevel = 'medium';

    const successProbability = Number((logistic((score - 50) / 10 + consistency.consistency_score / 30 + (profile.time_availability_hours ?? 2) / 2 - missingSkills / 8) * 100).toFixed(2));

    const actionSuggestions = await getClaudeJson<string[]>(
      'You give short actionable weekly coaching recommendations.',
      `Given this student's situation, give 3 specific, actionable steps they must take this week:\n${JSON.stringify({ profile, analysis, consistency, riskLevel, readyInMonths })}`,
      [
        'Finish two high-impact roadmap tasks this week.',
        'Spend one focused session on the top missing skill.',
        'Publish one proof-of-work update to maintain consistency.',
      ],
    );

    const payload = {
      user_id: userId,
      risk_level: riskLevel,
      ready_in_months: readyInMonths,
      risk_factors: [
        missingSkills > 5 ? 'Too many missing role-critical skills' : null,
        consistency.consistency_score < 35 ? 'Low recent activity consistency' : null,
        graduationMonths < 6 ? 'Limited time before graduation' : null,
      ].filter(Boolean),
      action_suggestions: actionSuggestions,
      success_probability: successProbability,
      predicted_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('failure_predictions').insert(payload).select().single();
    if (error) throw new AppError(error.message, 500, 'PREDICTION_FAILED');
    return data;
  }
}
