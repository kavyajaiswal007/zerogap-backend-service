import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getProfileOrThrow } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';

export class CollegePanelService {
  static async dashboard(userId: string) {
    const profile = await getProfileOrThrow(userId);
    if (!profile.college_name) throw new AppError('College name missing in profile', 400, 'COLLEGE_NAME_MISSING');

    const [{ data: students }, { data: analytics }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, degree, graduation_year').eq('college_name', profile.college_name),
      supabaseAdmin.from('college_analytics').select('*').eq('college_name', profile.college_name).maybeSingle(),
    ]);

    return {
      college_name: profile.college_name,
      analytics,
      student_count: students?.length ?? 0,
    };
  }

  static async students(userId: string) {
    const profile = await getProfileOrThrow(userId);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, degree, graduation_year, college_name')
      .eq('college_name', profile.college_name ?? '')
      .order('full_name');
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  static async placementReadiness(userId: string) {
    const students = await this.students(userId);
    const ids = students.map((student) => student.id);
    const { data: analyses } = await supabaseAdmin.from('skill_gap_analyses').select('user_id, skill_score').in('user_id', ids);
    const ready = (analyses ?? []).filter((item) => Number(item.skill_score ?? 0) >= 80).length;
    return {
      total_students: students.length,
      job_ready_students: ready,
      placement_readiness_percentage: students.length ? Number(((ready / students.length) * 100).toFixed(2)) : 0,
    };
  }

  static async skillHeatmap(userId: string) {
    const students = await this.students(userId);
    const ids = students.map((student) => student.id);
    const { data } = await supabaseAdmin.from('user_skills').select('skill_name, proficiency_level').in('user_id', ids);
    const aggregate = new Map<string, number[]>();
    for (const skill of data ?? []) {
      const existing = aggregate.get(skill.skill_name) ?? [];
      existing.push(skill.proficiency_level ?? 0);
      aggregate.set(skill.skill_name, existing);
    }
    return [...aggregate.entries()].map(([skill, scores]) => ({
      skill,
      average_proficiency: Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2)),
    })).sort((a, b) => b.average_proficiency - a.average_proficiency);
  }

  static async trainingRecommendations(userId: string) {
    const heatmap = await this.skillHeatmap(userId);
    return getClaudeJson<string[]>(
      'Recommend college training programs based on aggregate skill gaps.',
      `Based on these aggregate skill scores, what 3 training programs should be prioritized?\n${JSON.stringify(heatmap.slice(-10))}`,
      [
        'Run a full-stack application bootcamp focused on deployment-ready projects.',
        'Introduce weekly DSA and interview practice labs.',
        'Add GitHub portfolio review sessions with mentor feedback.',
      ],
    );
  }
}
