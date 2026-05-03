import { supabaseAdmin } from '../config/supabase.js';
import type { PlaylistRow, PlaylistWithUserState } from '../types/learnpath.types.js';
import { AppError } from './error.util.js';

interface UserLearningSignal {
  missingSkills: string[];
  partialSkills: string[];
  targetRoles: string[];
  profileSkills: string[];
}

interface EnrollmentRow {
  playlist_id: string;
  completed_at: string | null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function roleCategoryHints(role: string) {
  const text = normalize(role);
  if (text.includes('data') || text.includes('ml') || text.includes('machine')) return ['Data Science & ML', 'Databases'];
  if (text.includes('devops') || text.includes('cloud') || text.includes('sre')) return ['DevOps & Cloud', 'System Design'];
  if (text.includes('mobile') || text.includes('android') || text.includes('ios')) return ['Mobile Development'];
  if (text.includes('security') || text.includes('cyber')) return ['Cybersecurity'];
  if (text.includes('backend') || text.includes('api')) return ['Web Development - Backend', 'Databases', 'System Design'];
  return ['Web Development - Frontend', 'Web Development - Backend', 'DSA & CS Fundamentals'];
}

function difficultyWeight(difficulty: PlaylistRow['difficulty'], missingCount: number) {
  if (missingCount < 3) {
    return difficulty === 'advanced' ? 1 : difficulty === 'intermediate' ? 0.95 : 0.9;
  }
  if (difficulty === 'beginner') return 1;
  if (difficulty === 'intermediate') return 0.85;
  return 0.7;
}

function scorePlaylist(playlist: PlaylistRow, signals: UserLearningSignal) {
  const missing = signals.missingSkills.map(normalize);
  const partial = signals.partialSkills.map(normalize);
  const profileSkills = signals.profileSkills.map(normalize);
  const tags = playlist.skill_tags.map(normalize);

  if (missing.length) {
    const directHits = tags.filter((tag) => missing.some((skill) => tag.includes(skill) || skill.includes(tag))).length;
    const partialHits = tags.filter((tag) => partial.some((skill) => tag.includes(skill) || skill.includes(tag))).length;
    const novelty = tags.some((tag) => profileSkills.includes(tag)) ? 0.05 : 0.12;
    const base = directHits / Math.max(missing.length, 1);
    return Math.min(1, (base + partialHits * 0.08 + novelty) * difficultyWeight(playlist.difficulty, missing.length));
  }

  const roleCategories = new Set(signals.targetRoles.flatMap(roleCategoryHints));
  const categoryScore = roleCategories.has(playlist.category) ? 0.78 : 0.42;
  const skillOverlap = tags.filter((tag) => profileSkills.includes(tag)).length * 0.04;
  return Math.min(1, categoryScore + skillOverlap);
}

async function getUserSignals(userId: string): Promise<UserLearningSignal> {
  const [analysis, roles, skills] = await Promise.all([
    supabaseAdmin
      .from('skill_gap_analyses')
      .select('missing_skills, partial_skills')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('target_roles')
      .select('job_title')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('user_skills')
      .select('skill_name')
      .eq('user_id', userId),
  ]);

  if (analysis.error) throw new AppError(analysis.error.message, 500, 'LEARNPATH_SIGNAL_FAILED');
  if (roles.error) throw new AppError(roles.error.message, 500, 'LEARNPATH_SIGNAL_FAILED');
  if (skills.error) throw new AppError(skills.error.message, 500, 'LEARNPATH_SIGNAL_FAILED');

  return {
    missingSkills: asStringArray(analysis.data?.missing_skills),
    partialSkills: asStringArray(analysis.data?.partial_skills),
    targetRoles: (roles.data ?? []).map((role) => String(role.job_title)).filter(Boolean),
    profileSkills: (skills.data ?? []).map((skill) => String(skill.skill_name)).filter(Boolean),
  };
}

export async function getEnrollmentMap(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_playlist_enrollments')
    .select('playlist_id, completed_at')
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 500, 'LEARNPATH_ENROLLMENT_LOOKUP_FAILED');
  return new Map((data as EnrollmentRow[] | null ?? []).map((row) => [row.playlist_id, row]));
}

export async function getCompletionMap(userId: string, playlistIds: string[]) {
  if (!playlistIds.length) return new Map<string, number>();

  const [videos, progress] = await Promise.all([
    supabaseAdmin.from('playlist_videos').select('id, playlist_id').in('playlist_id', playlistIds),
    supabaseAdmin
      .from('user_video_progress')
      .select('video_id, playlist_id, is_watch_complete, quiz_passed')
      .eq('user_id', userId)
      .in('playlist_id', playlistIds),
  ]);

  if (videos.error) throw new AppError(videos.error.message, 500, 'LEARNPATH_PROGRESS_LOOKUP_FAILED');
  if (progress.error) throw new AppError(progress.error.message, 500, 'LEARNPATH_PROGRESS_LOOKUP_FAILED');

  const totals = new Map<string, number>();
  for (const row of videos.data ?? []) {
    totals.set(String(row.playlist_id), (totals.get(String(row.playlist_id)) ?? 0) + 1);
  }

  const completed = new Map<string, number>();
  for (const row of progress.data ?? []) {
    if (row.is_watch_complete && row.quiz_passed) {
      completed.set(String(row.playlist_id), (completed.get(String(row.playlist_id)) ?? 0) + 1);
    }
  }

  return new Map(
    playlistIds.map((playlistId) => {
      const total = totals.get(playlistId) ?? 0;
      const done = completed.get(playlistId) ?? 0;
      return [playlistId, total ? Math.round((done / total) * 100) : 0];
    }),
  );
}

export async function getRecommendedPlaylists(userId: string, limit = 20): Promise<PlaylistWithUserState[]> {
  const [signals, enrollments, playlistsResult] = await Promise.all([
    getUserSignals(userId),
    getEnrollmentMap(userId),
    supabaseAdmin.from('playlists').select('*').order('created_at', { ascending: false }),
  ]);

  if (playlistsResult.error) throw new AppError(playlistsResult.error.message, 500, 'LEARNPATH_PLAYLIST_LOOKUP_FAILED');

  const playlists = (playlistsResult.data ?? []) as PlaylistRow[];
  const ranked = playlists
    .filter((playlist) => !enrollments.get(playlist.id)?.completed_at)
    .map((playlist) => ({
      ...playlist,
      match_score: scorePlaylist(playlist, signals),
      is_enrolled: enrollments.has(playlist.id),
    }))
    .sort((left, right) => (right.match_score ?? 0) - (left.match_score ?? 0))
    .slice(0, limit);

  const completionMap = await getCompletionMap(userId, ranked.map((playlist) => playlist.id));
  return ranked.map((playlist) => ({
    ...playlist,
    completion_percentage: completionMap.get(playlist.id) ?? 0,
  }));
}
