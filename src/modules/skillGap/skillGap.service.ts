import { supabaseAdmin } from '../../config/supabase.js';
import { calculateSkillScore } from '../../utils/scoreCalculator.util.js';
import { getActiveTargetRole, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';
import { ExecutionTrackerService } from '../executionTracker/executionTracker.service.js';
import { JobMarketService } from '../jobMarket/jobMarket.service.js';

function fallbackSkillsForRole(role: string) {
  const normalized = role.toLowerCase();

  if (normalized.includes('frontend') || normalized.includes('react')) {
    return ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Git', 'REST APIs', 'Testing'];
  }

  if (normalized.includes('backend') || normalized.includes('node')) {
    return ['JavaScript', 'TypeScript', 'Node.js', 'Express.js', 'SQL', 'PostgreSQL', 'Git', 'APIs'];
  }

  if (normalized.includes('data') || normalized.includes('analyst')) {
    return ['Python', 'SQL', 'Statistics', 'Excel', 'Data Visualization', 'Pandas', 'Dashboards', 'Communication'];
  }

  if (normalized.includes('ai') || normalized.includes('ml') || normalized.includes('machine')) {
    return ['Python', 'Machine Learning', 'Statistics', 'SQL', 'Data Cleaning', 'Model Evaluation', 'Git', 'APIs'];
  }

  return ['Problem Solving', 'Git', 'JavaScript', 'SQL', 'Communication', 'APIs', 'Testing', 'Deployment'];
}

export class SkillGapService {
  static async getMarketSkills(role: string) {
    let { data: matrix, error } = await supabaseAdmin
      .from('skill_matrix')
      .select('*')
      .eq('job_title', role)
      .order('market_demand_score', { ascending: false });

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    if (!matrix?.length) {
      let skills: string[] = [];

      try {
        const market = await JobMarketService.refreshRole(role);
        skills = market.cache.top_skills ?? [];
      } catch {
        skills = [];
      }

      if (!skills.length) {
        skills = fallbackSkillsForRole(role);
      }

      if (skills.length) {
        await supabaseAdmin.from('skill_matrix').upsert(
          skills.map((skill: string) => ({
            job_title: role,
            skill_name: skill,
            skill_category: 'market',
            is_mandatory: true,
            market_demand_score: 80,
          })),
          { onConflict: 'job_title,skill_name' },
        );
      }
      matrix = skills.map((skill: string) => ({ skill_name: skill, market_demand_score: 80, is_mandatory: true }));
    }

    return matrix ?? [];
  }

  static async analyze(userId: string, targetRoleId?: string) {
    const userSkills = await getUserSkills(userId);
    const targetRole = targetRoleId
      ? (await supabaseAdmin.from('target_roles').select('*').eq('id', targetRoleId).single()).data
      : await getActiveTargetRole(userId);

    if (!targetRole) {
      throw new AppError('Target role not found', 404, 'TARGET_ROLE_NOT_FOUND');
    }

    const requiredSkills = await this.getMarketSkills(targetRole.job_title);
    const skillMap = new Map(userSkills.map((skill) => [skill.skill_name.toLowerCase(), skill]));

    const matched = requiredSkills.filter((required: any) => {
      const userSkill = skillMap.get(required.skill_name.toLowerCase());
      return userSkill && userSkill.proficiency_level >= 60;
    }).map((item: any) => item.skill_name);

    const partial = requiredSkills.filter((required: any) => {
      const userSkill = skillMap.get(required.skill_name.toLowerCase());
      return userSkill && userSkill.proficiency_level < 60;
    }).map((item: any) => item.skill_name);

    const missing = requiredSkills.filter((required: any) => !skillMap.has(required.skill_name.toLowerCase())).map((item: any) => item.skill_name);

    const skillsMatchPercentage = requiredSkills.length
      ? Number(((matched.length / requiredSkills.length) * 100).toFixed(2))
      : 0;

    const { data: proofs } = await supabaseAdmin.from('github_proofs').select('quality_score').eq('user_id', userId);
    const projectQualityScore = proofs?.length
      ? Number((proofs.reduce((sum, item) => sum + Number(item.quality_score ?? 0), 0) / proofs.length).toFixed(2))
      : 0;

    const consistency = await ExecutionTrackerService.getConsistency(userId);
    const breakdown = calculateSkillScore({
      skillsMatchPercentage,
      projectQualityScore,
      activityConsistencyScore: consistency.consistency_score,
    });

    const analysisPayload = {
      user_id: userId,
      target_role_id: targetRole.id,
      skill_score: breakdown.finalScore,
      matched_skills: matched,
      missing_skills: missing,
      partial_skills: partial,
      skills_match_percentage: breakdown.skillsMatchPercentage,
      project_quality_score: breakdown.projectQualityScore,
      activity_consistency_score: breakdown.activityConsistencyScore,
      analysis_data: {
        required_skills_count: requiredSkills.length,
        target_role: targetRole.job_title,
      },
    };

    const { data, error } = await supabaseAdmin.from('skill_gap_analyses').insert(analysisPayload).select().single();
    if (error) throw new AppError(error.message, 500, 'SKILL_GAP_ANALYSIS_FAILED');

    return data;
  }

  static async latest(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('skill_gap_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  static async history(userId: string) {
    const { data, error } = await supabaseAdmin.from('skill_gap_analyses').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }
}
