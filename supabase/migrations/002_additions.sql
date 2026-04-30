-- ZeroGap production polish additions.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_xp_cached INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score FLOAT NOT NULL,
  skills_match_pct FLOAT,
  project_quality FLOAT,
  activity_consistency FLOAT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_history_user_time ON score_history(user_id, recorded_at DESC);
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own score history" ON score_history;
CREATE POLICY "Users view own score history" ON score_history FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('achievement', 'score_update', 'job_match', 'roadmap', 'streak')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

ALTER TABLE skill_matrix ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'market_data';
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS template_name TEXT DEFAULT 'jake';

CREATE INDEX IF NOT EXISTS idx_profiles_college ON profiles(college_name);
CREATE INDEX IF NOT EXISTS idx_skill_gap_role ON skill_gap_analyses(target_role_id);
CREATE INDEX IF NOT EXISTS idx_user_job_matches_fit ON user_job_matches(user_id, fit_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC);
