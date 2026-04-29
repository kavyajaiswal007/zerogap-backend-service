CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'college', 'recruiter', 'mentor', 'parent', 'admin')),
  college_name TEXT,
  degree TEXT,
  graduation_year INT,
  location TEXT,
  bio TEXT,
  learning_style TEXT,
  time_availability_hours INT DEFAULT 2,
  github_username TEXT,
  linkedin_url TEXT,
  github_access_token TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE target_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  specialization TEXT,
  experience_level TEXT DEFAULT 'fresher' CHECK (experience_level IN ('fresher', 'junior', 'mid', 'senior')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skill_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  skill_category TEXT,
  importance_weight FLOAT DEFAULT 1.0,
  is_mandatory BOOLEAN DEFAULT FALSE,
  market_demand_score INT DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_title, skill_name)
);

CREATE TABLE user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level INT DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 100),
  verified BOOLEAN DEFAULT FALSE,
  proof_type TEXT CHECK (proof_type IN ('github', 'certificate', 'project', 'self_declared')),
  proof_url TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill_name)
);

CREATE TABLE skill_gap_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_role_id UUID REFERENCES target_roles(id) ON DELETE CASCADE,
  skill_score FLOAT NOT NULL,
  matched_skills JSONB DEFAULT '[]',
  missing_skills JSONB DEFAULT '[]',
  partial_skills JSONB DEFAULT '[]',
  skills_match_percentage FLOAT,
  project_quality_score FLOAT,
  activity_consistency_score FLOAT,
  analysis_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_role_id UUID REFERENCES target_roles(id),
  title TEXT NOT NULL,
  total_stages INT DEFAULT 4,
  estimated_weeks INT,
  is_active BOOLEAN DEFAULT TRUE,
  completion_percentage FLOAT DEFAULT 0,
  generated_by_ai BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roadmap_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skills_to_learn JSONB DEFAULT '[]',
  resources JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  estimated_weeks INT,
  is_completed BOOLEAN DEFAULT FALSE,
  completion_percentage FLOAT DEFAULT 0,
  order_index INT
);

CREATE TABLE roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES roadmap_stages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT CHECK (task_type IN ('learn', 'build', 'practice', 'certify', 'apply')),
  resource_url TEXT,
  estimated_hours FLOAT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  proof_url TEXT,
  xp_reward INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_role_id UUID REFERENCES target_roles(id),
  content_json JSONB NOT NULL,
  ats_score FLOAT,
  keyword_match_score FLOAT,
  pdf_url TEXT,
  version INT DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  context_type TEXT DEFAULT 'general' CHECK (context_type IN ('general', 'skill_gap', 'roadmap', 'job_prep', 'motivation')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE github_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  language TEXT,
  stars INT DEFAULT 0,
  commits INT DEFAULT 0,
  quality_score FLOAT,
  skills_detected JSONB DEFAULT '[]',
  complexity_score FLOAT,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_name)
);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  issuer TEXT,
  issue_date DATE,
  expiry_date DATE,
  credential_url TEXT,
  file_url TEXT,
  skills_validated JSONB DEFAULT '[]',
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_market_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title TEXT NOT NULL,
  location TEXT DEFAULT 'India',
  avg_salary_lpa FLOAT,
  demand_trend TEXT,
  top_skills JSONB DEFAULT '[]',
  top_companies JSONB DEFAULT '[]',
  job_count INT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_title, location)
);

CREATE TABLE job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  salary_range TEXT,
  salary_lpa_min FLOAT,
  salary_lpa_max FLOAT,
  skills_required JSONB DEFAULT '[]',
  description TEXT,
  apply_url TEXT,
  source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_listing_id UUID REFERENCES job_listings(id),
  fit_percentage FLOAT,
  missing_skills JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  match_reason TEXT,
  saved BOOLEAN DEFAULT FALSE,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_listing_id)
);

CREATE TABLE peer_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  target_role TEXT NOT NULL,
  college_name TEXT,
  college_percentile FLOAT,
  branch_percentile FLOAT,
  national_percentile FLOAT,
  avg_college_score FLOAT,
  avg_national_score FLOAT,
  ranking_data JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES roadmap_tasks(id),
  action TEXT NOT NULL,
  time_spent_minutes INT DEFAULT 0,
  output_description TEXT,
  proof_url TEXT,
  date DATE DEFAULT CURRENT_DATE,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  badge_icon TEXT,
  xp_reward INT DEFAULT 100,
  condition_type TEXT,
  condition_value JSONB DEFAULT '{}'
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE user_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  total_xp INT DEFAULT 0,
  current_level INT DEFAULT 1,
  current_streak_days INT DEFAULT 0,
  longest_streak_days INT DEFAULT 0,
  last_active_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE failure_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  ready_in_months INT,
  risk_factors JSONB DEFAULT '[]',
  action_suggestions JSONB DEFAULT '[]',
  success_probability FLOAT,
  predicted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE generated_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  description TEXT,
  tech_stack JSONB DEFAULT '[]',
  skills_practiced JSONB DEFAULT '[]',
  difficulty_level TEXT,
  starter_code_url TEXT,
  github_template_url TEXT,
  step_by_step_guide JSONB DEFAULT '[]',
  is_github_ready BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE college_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name TEXT NOT NULL UNIQUE,
  avg_skill_score FLOAT,
  placement_readiness_percentage FLOAT,
  top_performing_domains JSONB DEFAULT '[]',
  training_recommendations JSONB DEFAULT '[]',
  total_students INT DEFAULT 0,
  job_ready_students INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own roles" ON target_roles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own skills" ON user_skills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own analyses" ON skill_gap_analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own roadmaps" ON roadmaps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own tasks" ON roadmap_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own resumes" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own chats" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own proofs" ON github_proofs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own certs" ON certificates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own matches" ON user_job_matches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own benchmarks" ON peer_benchmarks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own logs" ON execution_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own achievements" ON user_achievements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own xp" ON user_xp FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own predictions" ON failure_predictions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own projects" ON generated_projects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read skill matrix" ON skill_matrix FOR SELECT USING (true);
CREATE POLICY "Anyone can read job market" ON job_market_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can read job listings" ON job_listings FOR SELECT USING (true);
CREATE POLICY "Anyone can read achievements" ON achievements FOR SELECT USING (true);

CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_roadmap_tasks_stage ON roadmap_tasks(stage_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_job_listings_title ON job_listings(title);
CREATE INDEX idx_skill_gap_user ON skill_gap_analyses(user_id, created_at DESC);
CREATE INDEX idx_execution_logs_user_date ON execution_logs(user_id, date DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    updated_at = NOW();

  INSERT INTO public.user_xp (user_id, total_xp, current_level)
  VALUES (NEW.id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.chat_sessions (user_id, title, context_type)
  VALUES (NEW.id, 'Welcome to ZeroGap', 'general')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
