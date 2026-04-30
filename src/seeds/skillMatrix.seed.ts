import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.util.js';

const SKILL_MATRIX_DATA = [
  { job_title: 'Frontend Developer', skill_name: 'React', skill_category: 'Framework', importance_weight: 1, is_mandatory: true, market_demand_score: 95 },
  { job_title: 'Frontend Developer', skill_name: 'JavaScript', skill_category: 'Language', importance_weight: 1, is_mandatory: true, market_demand_score: 99 },
  { job_title: 'Frontend Developer', skill_name: 'TypeScript', skill_category: 'Language', importance_weight: 0.9, is_mandatory: false, market_demand_score: 88 },
  { job_title: 'Frontend Developer', skill_name: 'HTML/CSS', skill_category: 'Core', importance_weight: 1, is_mandatory: true, market_demand_score: 99 },
  { job_title: 'Frontend Developer', skill_name: 'Next.js', skill_category: 'Framework', importance_weight: 0.85, is_mandatory: false, market_demand_score: 82 },
  { job_title: 'Frontend Developer', skill_name: 'Tailwind CSS', skill_category: 'Styling', importance_weight: 0.8, is_mandatory: false, market_demand_score: 78 },
  { job_title: 'Frontend Developer', skill_name: 'Git', skill_category: 'Tool', importance_weight: 0.9, is_mandatory: true, market_demand_score: 98 },
  { job_title: 'Frontend Developer', skill_name: 'REST APIs', skill_category: 'Integration', importance_weight: 0.85, is_mandatory: true, market_demand_score: 92 },

  { job_title: 'Backend Developer', skill_name: 'Node.js', skill_category: 'Runtime', importance_weight: 1, is_mandatory: true, market_demand_score: 95 },
  { job_title: 'Backend Developer', skill_name: 'Express.js', skill_category: 'Framework', importance_weight: 0.9, is_mandatory: true, market_demand_score: 90 },
  { job_title: 'Backend Developer', skill_name: 'PostgreSQL', skill_category: 'Database', importance_weight: 0.9, is_mandatory: true, market_demand_score: 88 },
  { job_title: 'Backend Developer', skill_name: 'REST API Design', skill_category: 'Architecture', importance_weight: 1, is_mandatory: true, market_demand_score: 96 },
  { job_title: 'Backend Developer', skill_name: 'TypeScript', skill_category: 'Language', importance_weight: 0.85, is_mandatory: false, market_demand_score: 85 },
  { job_title: 'Backend Developer', skill_name: 'Redis', skill_category: 'Cache', importance_weight: 0.8, is_mandatory: false, market_demand_score: 75 },
  { job_title: 'Backend Developer', skill_name: 'Docker', skill_category: 'DevOps', importance_weight: 0.8, is_mandatory: false, market_demand_score: 80 },
  { job_title: 'Backend Developer', skill_name: 'Authentication/JWT', skill_category: 'Security', importance_weight: 0.9, is_mandatory: true, market_demand_score: 92 },

  { job_title: 'Full Stack Developer', skill_name: 'React', skill_category: 'Framework', importance_weight: 1, is_mandatory: true, market_demand_score: 95 },
  { job_title: 'Full Stack Developer', skill_name: 'Node.js', skill_category: 'Runtime', importance_weight: 1, is_mandatory: true, market_demand_score: 94 },
  { job_title: 'Full Stack Developer', skill_name: 'JavaScript', skill_category: 'Language', importance_weight: 1, is_mandatory: true, market_demand_score: 99 },
  { job_title: 'Full Stack Developer', skill_name: 'TypeScript', skill_category: 'Language', importance_weight: 0.9, is_mandatory: false, market_demand_score: 88 },
  { job_title: 'Full Stack Developer', skill_name: 'PostgreSQL', skill_category: 'Database', importance_weight: 0.85, is_mandatory: true, market_demand_score: 86 },
  { job_title: 'Full Stack Developer', skill_name: 'REST APIs', skill_category: 'Integration', importance_weight: 0.95, is_mandatory: true, market_demand_score: 96 },
  { job_title: 'Full Stack Developer', skill_name: 'Git', skill_category: 'Tool', importance_weight: 0.9, is_mandatory: true, market_demand_score: 98 },
  { job_title: 'Full Stack Developer', skill_name: 'Docker', skill_category: 'DevOps', importance_weight: 0.75, is_mandatory: false, market_demand_score: 78 },
  { job_title: 'Full Stack Developer', skill_name: 'Next.js', skill_category: 'Framework', importance_weight: 0.85, is_mandatory: false, market_demand_score: 82 },
  { job_title: 'Full Stack Developer', skill_name: 'System Design Basics', skill_category: 'Architecture', importance_weight: 0.75, is_mandatory: false, market_demand_score: 74 },

  { job_title: 'Data Scientist', skill_name: 'Python', skill_category: 'Language', importance_weight: 1, is_mandatory: true, market_demand_score: 99 },
  { job_title: 'Data Scientist', skill_name: 'Machine Learning', skill_category: 'AI/ML', importance_weight: 1, is_mandatory: true, market_demand_score: 97 },
  { job_title: 'Data Scientist', skill_name: 'Pandas/NumPy', skill_category: 'Library', importance_weight: 0.95, is_mandatory: true, market_demand_score: 95 },
  { job_title: 'Data Scientist', skill_name: 'Statistics', skill_category: 'Mathematics', importance_weight: 0.9, is_mandatory: true, market_demand_score: 92 },
  { job_title: 'Data Scientist', skill_name: 'SQL', skill_category: 'Database', importance_weight: 0.9, is_mandatory: true, market_demand_score: 93 },
  { job_title: 'Data Scientist', skill_name: 'TensorFlow/PyTorch', skill_category: 'Framework', importance_weight: 0.85, is_mandatory: false, market_demand_score: 84 },
  { job_title: 'Data Scientist', skill_name: 'Data Visualization', skill_category: 'Tool', importance_weight: 0.8, is_mandatory: false, market_demand_score: 80 },

  { job_title: 'DevOps Engineer', skill_name: 'Docker', skill_category: 'Container', importance_weight: 1, is_mandatory: true, market_demand_score: 97 },
  { job_title: 'DevOps Engineer', skill_name: 'Kubernetes', skill_category: 'Orchestration', importance_weight: 0.95, is_mandatory: true, market_demand_score: 93 },
  { job_title: 'DevOps Engineer', skill_name: 'CI/CD (GitHub Actions/Jenkins)', skill_category: 'Pipeline', importance_weight: 1, is_mandatory: true, market_demand_score: 96 },
  { job_title: 'DevOps Engineer', skill_name: 'Linux', skill_category: 'OS', importance_weight: 0.95, is_mandatory: true, market_demand_score: 98 },
  { job_title: 'DevOps Engineer', skill_name: 'AWS/GCP/Azure', skill_category: 'Cloud', importance_weight: 0.95, is_mandatory: true, market_demand_score: 95 },
  { job_title: 'DevOps Engineer', skill_name: 'Terraform', skill_category: 'IaC', importance_weight: 0.85, is_mandatory: false, market_demand_score: 84 },

  { job_title: 'Android Developer', skill_name: 'Kotlin', skill_category: 'Language', importance_weight: 1, is_mandatory: true, market_demand_score: 96 },
  { job_title: 'Android Developer', skill_name: 'Android SDK', skill_category: 'Platform', importance_weight: 1, is_mandatory: true, market_demand_score: 98 },
  { job_title: 'Android Developer', skill_name: 'Jetpack Compose', skill_category: 'UI Framework', importance_weight: 0.9, is_mandatory: false, market_demand_score: 88 },
  { job_title: 'Android Developer', skill_name: 'REST APIs', skill_category: 'Integration', importance_weight: 0.9, is_mandatory: true, market_demand_score: 93 },
  { job_title: 'Android Developer', skill_name: 'MVVM Architecture', skill_category: 'Architecture', importance_weight: 0.85, is_mandatory: true, market_demand_score: 85 },
  { job_title: 'Android Developer', skill_name: 'Firebase', skill_category: 'Backend', importance_weight: 0.8, is_mandatory: false, market_demand_score: 80 },
];

export async function seedSkillMatrixIfEmpty() {
  const { count, error: countError } = await supabaseAdmin
    .from('skill_matrix')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    logger.warn({
      message: 'Skill matrix count check failed',
      error: countError.message,
    });
    return;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('skill_matrix')
    .upsert(SKILL_MATRIX_DATA, { onConflict: 'job_title,skill_name' });

  if (error) {
    logger.warn({
      message: 'Skill matrix seed failed',
      error: error.message,
    });
    return;
  }

  logger.info({
    message: 'Skill matrix seeded',
    count: SKILL_MATRIX_DATA.length,
  });
}
