CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yt_playlist_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  channel_name TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  total_videos INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  skill_tags TEXT[] NOT NULL DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')) DEFAULT 'beginner',
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playlist_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  yt_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playlist_id, position)
);

CREATE TABLE IF NOT EXISTS video_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES playlist_videos(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option_id TEXT NOT NULL,
  explanation TEXT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  UNIQUE(video_id, position)
);

CREATE TABLE IF NOT EXISTS user_playlist_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  is_recommended BOOLEAN DEFAULT false,
  last_notification_at TIMESTAMPTZ,
  UNIQUE(user_id, playlist_id)
);

CREATE TABLE IF NOT EXISTS user_video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES playlist_videos(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  watch_seconds INTEGER DEFAULT 0,
  is_watch_complete BOOLEAN DEFAULT false,
  quiz_attempts INTEGER DEFAULT 0,
  quiz_score NUMERIC(5,2),
  quiz_passed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

CREATE TABLE IF NOT EXISTS learning_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_video_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES playlist_videos(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  badge_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_path_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  UNIQUE(path_id, playlist_id),
  UNIQUE(path_id, step_number)
);

CREATE TABLE IF NOT EXISTS user_path_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  certificate_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT,
  pdf_storage_path TEXT,
  UNIQUE(user_id, path_id)
);

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificate_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS overall_quiz_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS total_watch_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_playlist_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_path_certificates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'playlists' AND policyname = 'Public playlists read') THEN
    CREATE POLICY "Public playlists read" ON playlists FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'playlist_videos' AND policyname = 'Public videos read') THEN
    CREATE POLICY "Public videos read" ON playlist_videos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_questions' AND policyname = 'Public questions read') THEN
    CREATE POLICY "Public questions read" ON video_questions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_playlist_enrollments' AND policyname = 'Own enrollments') THEN
    CREATE POLICY "Own enrollments" ON user_playlist_enrollments FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'Own progress') THEN
    CREATE POLICY "Own progress" ON user_video_progress FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'learning_streaks' AND policyname = 'Own learning streaks') THEN
    CREATE POLICY "Own learning streaks" ON learning_streaks FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_video_notes' AND policyname = 'Own video notes') THEN
    CREATE POLICY "Own video notes" ON user_video_notes FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'learning_paths' AND policyname = 'Public learning paths read') THEN
    CREATE POLICY "Public learning paths read" ON learning_paths FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'learning_path_playlists' AND policyname = 'Public learning path playlists read') THEN
    CREATE POLICY "Public learning path playlists read" ON learning_path_playlists FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_path_certificates' AND policyname = 'Own path certificates') THEN
    CREATE POLICY "Own path certificates" ON user_path_certificates FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_playlists_category ON playlists(category);
CREATE INDEX IF NOT EXISTS idx_playlists_skill_tags ON playlists USING gin(skill_tags);
CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist ON playlist_videos(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_video_questions_video ON video_questions(video_id, position);
CREATE INDEX IF NOT EXISTS idx_user_playlist_enrollments_user ON user_playlist_enrollments(user_id, enrolled_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_user_playlist ON user_video_progress(user_id, playlist_id);
CREATE INDEX IF NOT EXISTS idx_user_video_notes_user_playlist ON user_video_notes(user_id, playlist_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learnpath_certificates_user_playlist
  ON certificates(user_id, playlist_id)
  WHERE playlist_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_learnpath_certificates_code
  ON certificates(certificate_code)
  WHERE certificate_code IS NOT NULL;
