import { supabaseAdmin } from '../../config/supabase.js';
import { redis, isRedisEnabled } from '../../config/redis.js';
import { calculateSkillScore } from '../../utils/scoreCalculator.util.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getActiveTargetRole, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';
import { ExecutionTrackerService } from '../executionTracker/executionTracker.service.js';
import { JobMarketService } from '../jobMarket/jobMarket.service.js';

const STOCK_USER_SKILLS = [
  { skill_name: 'React', proficiency_level: 65 },
  { skill_name: 'JavaScript', proficiency_level: 70 },
  { skill_name: 'TypeScript', proficiency_level: 55 },
];

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  'node js': ['nodejs', 'node'],
  'express js': ['express'],
  'rest apis': ['api', 'apis', 'rest api'],
  postgresql: ['postgres', 'sql'],
  'tailwind css': ['tailwind'],
  'html css': ['html', 'css'],
};

function normalizeSkillName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fuzzySkillMatch(required: string, actual: string) {
  const left = normalizeSkillName(required);
  const right = normalizeSkillName(actual);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const aliases = SKILL_ALIASES[left] ?? [];
  return aliases.some((alias) => normalizeSkillName(alias) === right);
}

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
  private static async ensureTargetRole(userId: string, targetRoleId?: string) {
    if (targetRoleId) {
      const { data } = await supabaseAdmin.from('target_roles').select('*').eq('id', targetRoleId).single();
      return data;
    }

    const existing = await getActiveTargetRole(userId);
    if (existing) return existing;

    const { data, error } = await supabaseAdmin
      .from('target_roles')
      .insert({
        user_id: userId,
        job_title: 'Full Stack Developer',
        experience_level: 'fresher',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500, 'TARGET_ROLE_CREATE_FAILED');
    return data;
  }

  private static async ensureUserSkills(userId: string) {
    const existing = await getUserSkills(userId);
    if (existing.length) return existing;

    const { data, error } = await supabaseAdmin
      .from('user_skills')
      .upsert(
        STOCK_USER_SKILLS.map((skill) => ({
          user_id: userId,
          ...skill,
          verified: false,
          proof_type: 'self_declared',
        })),
        { onConflict: 'user_id,skill_name' },
      )
      .select()
      .order('skill_name');

    if (error) throw new AppError(error.message, 500, 'USER_SKILLS_SEED_FAILED');
    return data ?? existing;
  }

  private static async enrichAnalysisWithAI(
    targetRole: string,
    userSkills: Array<{ skill_name: string; proficiency_level: number | null }>,
    matched: string[],
    partial: string[],
    missing: string[],
  ) {
    const fallbackMissing = Array.from(new Set([
      ...missing,
      ...fallbackSkillsForRole(targetRole),
      'System Design',
      'Testing Strategy',
      'Cloud Deployment',
      'Product Thinking',
    ])).slice(0, 12);
    const fallbackPartial = Array.from(new Set([
      ...partial,
      ...userSkills.map((skill) => skill.skill_name),
      'API Design',
      'Database Optimization',
      'Performance Debugging',
      'GitHub Actions',
      'Resume Proof Writing',
    ])).slice(0, 15);
    const fallbackSkillScores = Object.fromEntries(
      fallbackMissing.map((skill, index) => [skill, Math.max(52, 92 - index * 3)]),
    );

    const system = `You are a senior career analyst for ZeroGap.
Generate 8-12 missing skills and 10-15 partial skills. Be specific about what is missing for the target role. Each missing skill should include a reason why it matters. Also return skill_scores mapping every missing skill to a predicted market demand score from 0 to 100.
Return ONLY valid JSON, no markdown.`;

    const prompt = `Target role: ${targetRole}
User skills: ${JSON.stringify(userSkills)}
Matched skills: ${matched.join(', ')}
Partial skills: ${partial.join(', ')}
Missing skills: ${missing.join(', ')}

Return this JSON:
{
  "missing_skills": ["8-12 skill names"],
  "partial_skills": ["10-15 skill names the user has but must improve"],
  "missing_skill_reasons": [
    { "skill": "System Design", "reason": "Why this matters for the target role" }
  ],
  "recommended_resources": [
    { "title": "resource title", "type": "playlist/course/docs", "url": "https://...", "reason": "why it helps" }
  ],
  "skill_scores": { "System Design": 94, "Testing Strategy": 81 },
  "estimated_readiness_weeks": 8
}`;

    return getClaudeJson(system, prompt, {
      missing_skills: fallbackMissing,
      partial_skills: fallbackPartial,
      missing_skill_reasons: fallbackMissing.map((skill) => ({
        skill,
        reason: `${skill} is important for ${targetRole} interviews and production-ready project work.`,
      })),
      recommended_resources: [
        {
          title: `${targetRole} project roadmap`,
          type: 'playlist',
          url: 'https://www.youtube.com/@freecodecamp',
          reason: 'Builds role-specific proof projects and interview vocabulary.',
        },
        {
          title: 'System Design fundamentals',
          type: 'playlist',
          url: 'https://www.youtube.com/@GauravSensei',
          reason: 'Improves architecture discussion for interviews.',
        },
        {
          title: 'Testing and deployment practice',
          type: 'docs',
          url: 'https://docs.github.com/en/actions',
          reason: 'Turns projects into recruiter-ready production proof.',
        },
      ],
      skill_scores: fallbackSkillScores,
      estimated_readiness_weeks: 8,
    });
  }

  static async getMarketSkills(role: string) {
    let { data: matrix, error } = await supabaseAdmin
      .from('skill_matrix')
      .select('*')
      .eq('job_title', role)
      .order('market_demand_score', { ascending: false });

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    if (!matrix?.length || matrix.length < 5) {
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
      const existingNames = new Set((matrix ?? []).map((item: any) => String(item.skill_name).toLowerCase()));
      matrix = [
        ...(matrix ?? []),
        ...skills
          .filter((skill: string) => !existingNames.has(skill.toLowerCase()))
          .map((skill: string) => ({ skill_name: skill, market_demand_score: 80, is_mandatory: true })),
      ];
    }

    return matrix ?? [];
  }

  static async analyze(userId: string, targetRoleId?: string) {
    const [userSkills, targetRole] = await Promise.all([
      this.ensureUserSkills(userId),
      this.ensureTargetRole(userId, targetRoleId),
    ]);

    if (!targetRole) {
      throw new AppError('Target role not found', 404, 'TARGET_ROLE_NOT_FOUND');
    }

    const requiredSkills = await this.getMarketSkills(targetRole.job_title);
    const findUserSkill = (requiredName: string) =>
      userSkills.find((skill) => fuzzySkillMatch(requiredName, skill.skill_name));

    const matched = requiredSkills.filter((required: any) => {
      const userSkill = findUserSkill(required.skill_name);
      return userSkill && userSkill.proficiency_level >= 60;
    }).map((item: any) => item.skill_name);

    const partial = requiredSkills.filter((required: any) => {
      const userSkill = findUserSkill(required.skill_name);
      return userSkill && userSkill.proficiency_level < 60;
    }).map((item: any) => item.skill_name);

    const missing = requiredSkills.filter((required: any) => !findUserSkill(required.skill_name)).map((item: any) => item.skill_name);

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

    const enriched = await this.enrichAnalysisWithAI(
      targetRole.job_title,
      userSkills,
      matched,
      partial,
      missing,
    );
    const enrichedMissing = enriched.missing_skills?.length ? enriched.missing_skills : missing;
    const enrichedPartial = enriched.partial_skills?.length ? enriched.partial_skills : partial;
    const skillScores = enriched.skill_scores ?? Object.fromEntries(
      enrichedMissing.map((skill: string, index: number) => [skill, Math.max(52, 92 - index * 3)]),
    );

    const analysisPayload = {
      user_id: userId,
      target_role_id: targetRole.id,
      skill_score: breakdown.finalScore,
      matched_skills: matched,
      missing_skills: enrichedMissing,
      partial_skills: enrichedPartial,
      skills_match_percentage: breakdown.skillsMatchPercentage,
      project_quality_score: breakdown.projectQualityScore,
      activity_consistency_score: breakdown.activityConsistencyScore,
      analysis_data: {
        required_skills_count: requiredSkills.length,
        target_role: targetRole.job_title,
        recommended_resources: enriched.recommended_resources ?? [],
        estimated_readiness_weeks: enriched.estimated_readiness_weeks ?? 8,
        missing_skill_reasons: enriched.missing_skill_reasons ?? [],
        skill_scores: skillScores,
      },
    };

    const { data, error } = await supabaseAdmin.from('skill_gap_analyses').insert(analysisPayload).select().single();
    if (error) throw new AppError(error.message, 500, 'SKILL_GAP_ANALYSIS_FAILED');

    return data;
  }

  static async smartAnalyze(userId: string) {
    if (isRedisEnabled()) {
      const cached = await redis.get(`skill-gap:latest:${userId}`);
      if (cached) return JSON.parse(cached);
    }

    const result = await this.analyze(userId);

    if (isRedisEnabled()) {
      await redis.set(`skill-gap:latest:${userId}`, JSON.stringify(result), 'EX', 86400);
    }

    return result;
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
