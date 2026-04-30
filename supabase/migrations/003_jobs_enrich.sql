ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'Full-time';
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS experience_required TEXT;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS company_logo TEXT;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_listings_external_id_unique
  ON job_listings(external_id)
  WHERE external_id IS NOT NULL;
