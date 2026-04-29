import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getActiveTargetRole, getLatestSkillGapAnalysis, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';

export class ProjectBuilderService {
  static async generate(userId: string, difficulty = 'intermediate') {
    const [targetRole, skills, analysis] = await Promise.all([
      getActiveTargetRole(userId),
      getUserSkills(userId),
      getLatestSkillGapAnalysis(userId),
    ]);

    const payload = await getClaudeJson<any>(
      'Design portfolio projects for students targeting tech roles.',
      `Design a portfolio project for a student targeting ${targetRole?.job_title ?? 'Software Engineer'}. They know ${skills.map((skill) => skill.skill_name).join(', ')}. They need to practice ${JSON.stringify(analysis?.missing_skills ?? [])}. Return a detailed project spec with: title, description, tech_stack, step_by_step_guide (10 steps), starter file structure, README template, and GitHub setup instructions. Make it impressive enough to put on resume.`,
      {
        title: `${targetRole?.job_title ?? 'Software'} Portfolio Project`,
        description: 'A practical portfolio project aligned to the target role.',
        tech_stack: skills.slice(0, 5).map((skill) => skill.skill_name),
        skills_practiced: analysis?.missing_skills ?? [],
        difficulty_level: difficulty,
        starter_code_url: null,
        github_template_url: null,
        step_by_step_guide: [
          'Define scope',
          'Set up repository',
          'Create UI plan',
          'Build core feature',
          'Connect database',
          'Add authentication',
          'Write tests',
          'Deploy',
          'Document work',
          'Publish demo',
        ],
      },
    );

    const { data, error } = await supabaseAdmin.from('generated_projects').insert({
      user_id: userId,
      project_title: payload.title,
      description: payload.description,
      tech_stack: payload.tech_stack ?? [],
      skills_practiced: payload.skills_practiced ?? [],
      difficulty_level: payload.difficulty_level ?? difficulty,
      starter_code_url: payload.starter_code_url,
      github_template_url: payload.github_template_url,
      step_by_step_guide: payload.step_by_step_guide ?? [],
      is_github_ready: true,
    }).select().single();
    if (error) throw new AppError(error.message, 500, 'PROJECT_GENERATE_FAILED');
    return data;
  }

  static async suggestions(userId: string) {
    const [targetRole, analysis] = await Promise.all([getActiveTargetRole(userId), getLatestSkillGapAnalysis(userId)]);
    const baseRole = targetRole?.job_title ?? 'Software Engineer';
    const missing = (analysis?.missing_skills ?? []).slice(0, 3);
    return [1, 2, 3].map((n) => ({
      title: `${baseRole} Project ${n}`,
      focus: missing[n - 1] ?? 'system design',
    }));
  }

  static async mine(userId: string) {
    const { data, error } = await supabaseAdmin.from('generated_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }
}
