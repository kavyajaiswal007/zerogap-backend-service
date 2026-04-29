import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

export interface ApiMeta {
  timestamp: string;
  version: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
  meta: ApiMeta;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export interface ClaudeRoadmapStage {
  stage_number: number;
  title: string;
  description: string;
  skills_to_learn: string[];
  resources: Array<{
    name: string;
    url: string;
    type: 'video' | 'article' | 'course' | 'book';
    platform: string;
    is_free: boolean;
  }>;
  projects: Array<{
    name: string;
    description: string;
    skills_practiced: string[];
    difficulty: string;
    github_template_url?: string;
  }>;
  estimated_weeks: number;
  tasks: Array<{
    title: string;
    description: string;
    task_type: 'learn' | 'build' | 'practice' | 'certify' | 'apply';
    resource_url?: string;
    estimated_hours: number;
    xp_reward: number;
  }>;
}
