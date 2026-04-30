import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getActiveTargetRole, getLatestSkillGapAnalysis, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';

const STOCK_TECH_STACK = ['React', 'TypeScript', 'Node.js', 'PostgreSQL'];
const STOCK_STEPS = [
  'Define the user story',
  'Create the repository',
  'Build the main UI',
  'Add API integration',
  'Persist one real record',
  'Add loading and error states',
  'Polish mobile layout',
  'Write a README',
  'Deploy the demo',
  'Record proof screenshots',
];

export class ProjectBuilderService {
  static async generate(userId: string, difficulty = 'intermediate') {
    const [targetRole, skills, analysis] = await Promise.all([
      getActiveTargetRole(userId),
      getUserSkills(userId),
      getLatestSkillGapAnalysis(userId),
    ]);

    const safeDifficulty = String(difficulty || 'intermediate').trim() || 'intermediate';
    const safeSkills = skills.length ? skills.map((skill) => skill.skill_name) : STOCK_TECH_STACK;
    const safeMissing = analysis?.missing_skills?.length ? analysis.missing_skills : ['API design', 'UI polish', 'deployment'];

    const payload = await getClaudeJson<any>(
      'Design portfolio projects for students targeting tech roles.',
      `Design a portfolio project for a student targeting ${targetRole?.job_title ?? 'Software Engineer'}. They know ${safeSkills.join(', ')}. They need to practice ${JSON.stringify(safeMissing)}. Return a detailed project spec with: title, description, tech_stack, step_by_step_guide (10 steps), starter file structure, README template, and GitHub setup instructions. Make it impressive enough to put on resume.`,
      {
        title: `${targetRole?.job_title ?? 'Software'} Portfolio Project`,
        description: 'A practical portfolio project aligned to the target role.',
        tech_stack: safeSkills.slice(0, 5),
        skills_practiced: safeMissing,
        difficulty_level: safeDifficulty,
        starter_code_url: null,
        github_template_url: null,
        step_by_step_guide: STOCK_STEPS,
      },
    );

    const { data, error } = await supabaseAdmin.from('generated_projects').insert({
      user_id: userId,
      project_title: payload.title ?? `${targetRole?.job_title ?? 'Software'} Portfolio Project`,
      description: payload.description ?? 'A practical portfolio project aligned to the target role.',
      tech_stack: payload.tech_stack?.length ? payload.tech_stack : safeSkills.slice(0, 5),
      skills_practiced: payload.skills_practiced?.length ? payload.skills_practiced : safeMissing,
      difficulty_level: payload.difficulty_level ?? safeDifficulty,
      starter_code_url: payload.starter_code_url,
      github_template_url: payload.github_template_url,
      step_by_step_guide: payload.step_by_step_guide?.length ? payload.step_by_step_guide : STOCK_STEPS,
      is_github_ready: true,
    }).select().single();
    if (error) throw new AppError(error.message, 500, 'PROJECT_GENERATE_FAILED');
    return data;
  }

  static async suggestions(userId: string) {
    const [targetRole, analysis] = await Promise.all([getActiveTargetRole(userId), getLatestSkillGapAnalysis(userId)]);
    const baseRole = targetRole?.job_title ?? 'Software Engineer';
    const missing = (analysis?.missing_skills?.length ? analysis.missing_skills : ['React', 'API design', 'Deployment']).slice(0, 3);
    return [1, 2, 3].map((n) => ({
      id: `stock-suggestion-${n}`,
      user_id: userId,
      project_title: `${baseRole} Proof Project ${n}`,
      description: `Build a portfolio-ready project focused on ${missing[n - 1] ?? 'system design'}.`,
      tech_stack: STOCK_TECH_STACK,
      skills_practiced: [missing[n - 1] ?? 'system design'],
      difficulty_level: n === 1 ? 'beginner' : n === 2 ? 'intermediate' : 'advanced',
      starter_code_url: null,
      github_template_url: null,
      step_by_step_guide: STOCK_STEPS,
      is_github_ready: true,
      created_at: new Date().toISOString(),
    }));
  }

  static async mine(userId: string) {
    const { data, error } = await supabaseAdmin.from('generated_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }
}
