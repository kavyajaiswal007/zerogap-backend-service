export type PlaylistDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface PlaylistRow {
  id: string;
  yt_playlist_id: string;
  title: string;
  description: string | null;
  channel_name: string;
  thumbnail_url: string;
  total_videos: number;
  total_duration_seconds: number | null;
  skill_tags: string[];
  difficulty: PlaylistDifficulty;
  category: string;
  created_at: string;
}

export interface PlaylistVideoRow {
  id: string;
  playlist_id: string;
  yt_video_id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  position: number;
  created_at: string;
}

export interface VideoQuestionRow {
  id: string;
  video_id: string;
  question_text: string;
  options: Array<{ id: string; text: string }>;
  correct_option_id: string;
  explanation: string | null;
  position: number;
}

export interface UserVideoProgressRow {
  id: string;
  user_id: string;
  video_id: string;
  playlist_id: string;
  watch_seconds: number;
  is_watch_complete: boolean;
  quiz_attempts: number;
  quiz_score: number | null;
  quiz_passed: boolean;
  completed_at: string | null;
  last_updated: string;
}

export interface PlaylistWithUserState extends PlaylistRow {
  match_score?: number;
  is_enrolled?: boolean;
  completion_percentage?: number;
}

export interface PlaylistProgressVideo extends PlaylistVideoRow {
  progress: {
    watch_seconds: number;
    is_watch_complete: boolean;
    quiz_passed: boolean;
    quiz_score: number | null;
  };
  note_text?: string;
}

export interface PlaylistProgressData {
  playlist: PlaylistRow;
  videos: PlaylistProgressVideo[];
  completed_videos: number;
  total_videos: number;
  playlist_completion_percentage: number;
  is_eligible_for_certificate: boolean;
  blockers: string[];
}

export interface CertificateRow {
  id: string;
  user_id: string;
  playlist_id: string | null;
  title: string;
  issuer: string | null;
  issue_date: string | null;
  credential_url: string | null;
  file_url: string | null;
  certificate_code: string | null;
  overall_quiz_score: number | null;
  total_watch_seconds: number | null;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  created_at: string;
}

export interface LearnPathStats {
  enrolled_count: number;
  certificates_earned: number;
  total_watch_hours: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
}

export interface LearningPathRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  badge_label: string | null;
  created_at: string;
}
