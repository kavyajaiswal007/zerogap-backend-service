import { v4 as uuid } from 'uuid';
import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getActiveTargetRole, getLatestSkillGapAnalysis, getProfileOrThrow, getUserSkills } from '../../utils/db.util.js';
import type { ClaudeRoadmapStage } from '../../types/index.js';
import { AppError } from '../../utils/error.util.js';
import { AchievementsService } from '../achievements/achievements.service.js';
import { ExecutionTrackerService } from '../executionTracker/executionTracker.service.js';
import { enqueueSkillAnalysis } from '../../queues/skillAnalysis.queue.js';

interface RoadmapPayload {
  title: string;
  estimated_weeks: number;
  stages: ClaudeRoadmapStage[];
}

const defaultRoadmap = (role = 'Software Engineer'): RoadmapPayload => ({
  title: `${role} Job-Ready Roadmap`,
  estimated_weeks: 16,
  stages: [
    {
      stage_number: 1,
      title: 'Fundamentals',
      description: 'Strengthen core concepts and close foundational gaps.',
      skills_to_learn: ['JavaScript', 'Git', 'Problem Solving'],
      resources: [],
      projects: [],
      estimated_weeks: 4,
      tasks: [
        { title: 'Refresh core syntax', description: 'Practice fundamentals daily', task_type: 'learn', estimated_hours: 8, xp_reward: 50 },
      ],
    },
    {
      stage_number: 2,
      title: 'Core Skills',
      description: 'Learn role-critical skills and build confidence.',
      skills_to_learn: ['React', 'APIs', 'SQL'],
      resources: [],
      projects: [],
      estimated_weeks: 4,
      tasks: [
        { title: 'Build a feature app', description: 'Create a mini production feature', task_type: 'build', estimated_hours: 12, xp_reward: 75 },
      ],
    },
    {
      stage_number: 3,
      title: 'Advanced',
      description: 'Move into advanced tools and system-level thinking.',
      skills_to_learn: ['Testing', 'Performance', 'Deployment'],
      resources: [],
      projects: [],
      estimated_weeks: 4,
      tasks: [
        { title: 'Ship with tests', description: 'Add automated coverage', task_type: 'practice', estimated_hours: 10, xp_reward: 75 },
      ],
    },
    {
      stage_number: 4,
      title: 'Projects & Portfolio',
      description: 'Turn learning into visible proof and job applications.',
      skills_to_learn: ['Portfolio', 'Resume', 'Interview Prep'],
      resources: [],
      projects: [],
      estimated_weeks: 4,
      tasks: [
        { title: 'Polish portfolio project', description: 'Publish final portfolio-ready work', task_type: 'apply', estimated_hours: 12, xp_reward: 100 },
      ],
    },
  ],
});

export class RoadmapService {
  private static async ensureTargetRole(userId: string) {
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

  static async generate(userId: string) {
    const [profile, targetRole, skills, analysis] = await Promise.all([
      getProfileOrThrow(userId),
      this.ensureTargetRole(userId),
      getUserSkills(userId),
      getLatestSkillGapAnalysis(userId),
    ]);

    const fallback = defaultRoadmap(targetRole.job_title);
    const roadmap = await getClaudeJson<RoadmapPayload>(
      'You are an expert career coach and curriculum designer. Generate a personalized 4-stage learning roadmap with exact JSON output.',
      `Input:
Current skills: ${JSON.stringify(skills)}
Missing skills: ${JSON.stringify(analysis?.missing_skills ?? [])}
Target role: ${targetRole.job_title}
Time availability per day: ${profile.time_availability_hours}
Learning style: ${profile.learning_style}
Graduation year: ${profile.graduation_year}

Return JSON:
{
  "title": string,
  "estimated_weeks": number,
  "stages": [{
    "stage_number": 1,
    "title": string,
    "description": string,
    "skills_to_learn": string[],
    "resources": [{"name": string, "url": string, "type": "video"|"article"|"course"|"book", "platform": string, "is_free": boolean}],
    "projects": [{"name": string, "description": string, "skills_practiced": string[], "difficulty": string, "github_template_url": string}],
    "estimated_weeks": number,
    "tasks": [{"title": string, "description": string, "task_type": "learn"|"build"|"practice"|"certify"|"apply", "resource_url": string, "estimated_hours": number, "xp_reward": number}]
  }]
}`,
      fallback,
    );

    await supabaseAdmin.from('roadmaps').update({ is_active: false }).eq('user_id', userId);

    const { data: createdRoadmap, error } = await supabaseAdmin.from('roadmaps').insert({
      user_id: userId,
      target_role_id: targetRole.id,
      title: roadmap.title,
      estimated_weeks: roadmap.estimated_weeks,
      total_stages: roadmap.stages.length,
      is_active: true,
      generated_by_ai: true,
    }).select().single();

    if (error) throw new AppError(error.message, 500, 'ROADMAP_CREATE_FAILED');

    for (const stage of roadmap.stages) {
      const { data: stageRow } = await supabaseAdmin.from('roadmap_stages').insert({
        roadmap_id: createdRoadmap.id,
        stage_number: stage.stage_number,
        title: stage.title,
        description: stage.description,
        skills_to_learn: stage.skills_to_learn,
        resources: stage.resources,
        projects: stage.projects,
        estimated_weeks: stage.estimated_weeks,
        order_index: stage.stage_number,
      }).select().single();

      if (stage.tasks.length && stageRow) {
        await supabaseAdmin.from('roadmap_tasks').insert(
          stage.tasks.map((task) => ({
            id: uuid(),
            stage_id: stageRow.id,
            user_id: userId,
            title: task.title,
            description: task.description,
            task_type: task.task_type,
            resource_url: task.resource_url,
            estimated_hours: task.estimated_hours,
            xp_reward: task.xp_reward,
          })),
        );
      }
    }

    return this.getRoadmap(createdRoadmap.id);
  }

  static async getActive(userId: string) {
    const { data } = await supabaseAdmin.from('roadmaps').select('*').eq('user_id', userId).eq('is_active', true).maybeSingle();
    if (!data) return null;
    return this.getRoadmap(data.id);
  }

  static async getOrGenerate(userId: string) {
    const existing = await this.getActive(userId);
    if (existing) return existing;

    this.generate(userId).catch(() => {});
    return null;
  }

  static async getRoadmap(id: string) {
    const { data: roadmap, error } = await supabaseAdmin.from('roadmaps').select('*').eq('id', id).single();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    const { data: stages } = await supabaseAdmin.from('roadmap_stages').select('*').eq('roadmap_id', id).order('stage_number');
    const stageIds = (stages ?? []).map((stage) => stage.id);
    const { data: tasks } = stageIds.length
      ? await supabaseAdmin.from('roadmap_tasks').select('*').in('stage_id', stageIds).order('created_at')
      : { data: [] as any[] };

    return {
      ...roadmap,
      stages: (stages ?? []).map((stage) => ({
        ...stage,
        tasks: (tasks ?? []).filter((task) => task.stage_id === stage.id),
      })),
    };
  }

  static async updateStage(userId: string, roadmapId: string, stageId: string, completion_percentage: number) {
    await supabaseAdmin.from('roadmap_stages').update({
      completion_percentage,
      is_completed: completion_percentage >= 100,
    }).eq('id', stageId);

    await this.refreshRoadmapCompletion(roadmapId);
    await AchievementsService.checkAndAward(userId);
    return this.getRoadmap(roadmapId);
  }

  static async completeTask(userId: string, taskId: string) {
    const { data: task, error } = await supabaseAdmin.from('roadmap_tasks').update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', taskId).eq('user_id', userId).select().single();

    if (error || !task) {
      throw new AppError(error?.message ?? 'Task not found', 404, 'TASK_COMPLETE_FAILED');
    }

    await ExecutionTrackerService.logActivity(userId, {
      task_id: taskId,
      action: `Completed roadmap task: ${task.title}`,
      time_spent_minutes: Math.round((task.estimated_hours ?? 1) * 60),
      xp_earned: task.xp_reward ?? 50,
    });

    const { data: stage } = await supabaseAdmin.from('roadmap_stages').select('id, roadmap_id').eq('id', task.stage_id).single();
    if (stage) {
      const { data: stageTasks } = await supabaseAdmin.from('roadmap_tasks').select('id, is_completed').eq('stage_id', stage.id);
      const total = stageTasks?.length ?? 0;
      const done = (stageTasks ?? []).filter((item) => item.is_completed).length;
      await supabaseAdmin.from('roadmap_stages').update({
        completion_percentage: total ? Number(((done / total) * 100).toFixed(2)) : 0,
        is_completed: total > 0 && total === done,
      }).eq('id', stage.id);

      await this.refreshRoadmapCompletion(stage.roadmap_id);
      await AchievementsService.checkAndAward(userId);
    }

    await enqueueSkillAnalysis(userId);
    return task;
  }

  static async progress(userId: string) {
    const roadmap = await this.getActive(userId);
    if (!roadmap) return null;

    const stages = roadmap.stages ?? [];
    const tasks = stages.flatMap((stage: any) => stage.tasks ?? []);

    return {
      roadmap_id: roadmap.id,
      completion_percentage: roadmap.completion_percentage,
      completed_stages: stages.filter((stage: any) => stage.is_completed).length,
      total_stages: stages.length,
      completed_tasks: tasks.filter((task: any) => task.is_completed).length,
      total_tasks: tasks.length,
    };
  }

  private static async refreshRoadmapCompletion(roadmapId: string) {
    const { data: stages } = await supabaseAdmin.from('roadmap_stages').select('completion_percentage').eq('roadmap_id', roadmapId);
    const completion = (stages ?? []).length
      ? Number(((stages ?? []).reduce((sum, stage) => sum + Number(stage.completion_percentage ?? 0), 0) / (stages ?? []).length).toFixed(2))
      : 0;
    await supabaseAdmin.from('roadmaps').update({
      completion_percentage: completion,
      updated_at: new Date().toISOString(),
    }).eq('id', roadmapId);
  }
}
