import axios from 'axios';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { AppError } from '../../utils/error.util.js';
import { logger } from '../../utils/logger.util.js';

interface JobHighlights {
  Responsibilities?: string[];
  Qualifications?: string[];
  Benefits?: string[];
  [key: string]: string[] | undefined;
}

interface JobListing {
  id?: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  skills_required: string[];
  apply_url: string | null;
  salary_range: string | null;
  salary_lpa_min: number | null;
  salary_lpa_max: number | null;
  source: string | null;
  is_active: boolean;
  posted_at: string | null;
  fetched_at: string;
  job_type: string | null;
  experience_required: string | null;
  is_remote: boolean;
  company_logo: string | null;
  highlights: JobHighlights;
  qualifications: string | null;
}

interface UserSkillRow {
  skill_name: string;
  proficiency_level: number | null;
}

interface TargetRoleRow {
  job_title: string;
}

interface SalaryEstimate {
  range: string;
  min: number;
  max: number;
}

const CACHE_STALE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_ROLE = 'Full Stack Developer';

const SKILL_KEYWORDS = [
  'React',
  'Vue',
  'Angular',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'Node.js',
  'Express',
  'Django',
  'FastAPI',
  'Spring Boot',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'Git',
  'REST API',
  'GraphQL',
  'Flutter',
  'React Native',
  'Swift',
  'Kotlin',
  'Android',
  'iOS',
  'Machine Learning',
  'TensorFlow',
  'PyTorch',
  'SQL',
  'Linux',
  'CI/CD',
  'Jenkins',
  'GitHub Actions',
  'Figma',
  'Tailwind CSS',
  'CSS',
  'HTML',
  'PHP',
  'Laravel',
  'Go',
  'Rust',
  'C++',
  'C#',
  '.NET',
  'Selenium',
  'Jest',
  'Cypress',
  'Power BI',
  'Tableau',
  'Excel',
  'Pandas',
  'NumPy',
  'Scikit-learn',
  'OpenAI',
];

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeHighlights(value: unknown): JobHighlights {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return {
    Responsibilities: normalizeStringArray(source.Responsibilities).slice(0, 8),
    Qualifications: normalizeStringArray(source.Qualifications).slice(0, 8),
    Benefits: normalizeStringArray(source.Benefits).slice(0, 6),
  };
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function cleanSalaryRange(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/null|undefined/i.test(trimmed)) return null;
  if (/^(?:[A-Z]{3}\s*)?0(?:\.0+)?\s*[-–]\s*0(?:\.0+)?/i.test(trimmed)) return null;
  return trimmed;
}

function formatSalaryRange(job: any): string | null {
  const min = positiveNumber(job.job_min_salary);
  const max = positiveNumber(job.job_max_salary);
  const currency = job.job_salary_currency;
  const period = job.job_salary_period;

  if (min === null && max === null) return null;

  if (currency === 'INR') {
    const minLpa = min !== null ? (period === 'MONTH' ? (min * 12) / 100000 : min / 100000) : null;
    const maxLpa = max !== null ? (period === 'MONTH' ? (max * 12) / 100000 : max / 100000) : null;
    if (minLpa && maxLpa) return `₹${minLpa.toFixed(1)}-${maxLpa.toFixed(1)} LPA`;
    if (maxLpa) return `Up to ₹${maxLpa.toFixed(1)} LPA`;
    if (minLpa) return `₹${minLpa.toFixed(1)}+ LPA`;
  }

  if (currency === 'USD') {
    const minLpa = min !== null ? (min * 83 * (period === 'MONTH' ? 12 : 1)) / 100000 : null;
    const maxLpa = max !== null ? (max * 83 * (period === 'MONTH' ? 12 : 1)) / 100000 : null;
    if (minLpa && maxLpa) return `₹${minLpa.toFixed(0)}-${maxLpa.toFixed(0)} LPA`;
    if (maxLpa) return `Up to ₹${maxLpa.toFixed(0)} LPA`;
    if (minLpa) return `₹${minLpa.toFixed(0)}+ LPA`;
  }

  if (min !== null && max !== null) {
    return `${currency ?? ''} ${min.toLocaleString()}-${max.toLocaleString()}${period ? ` (${period})` : ''}`.trim();
  }
  return null;
}

function normalizeSalaryMin(job: any): number | null {
  const min = positiveNumber(job.job_min_salary);
  if (min === null) return null;
  const multiplier = job.job_salary_period === 'MONTH' ? 12 : 1;
  if (job.job_salary_currency === 'INR') return Math.round((min * multiplier) / 100000 * 10) / 10;
  if (job.job_salary_currency === 'USD') return Math.round((min * 83 * multiplier) / 100000);
  return null;
}

function normalizeSalaryMax(job: any): number | null {
  const max = positiveNumber(job.job_max_salary);
  if (max === null) return null;
  const multiplier = job.job_salary_period === 'MONTH' ? 12 : 1;
  if (job.job_salary_currency === 'INR') return Math.round((max * multiplier) / 100000 * 10) / 10;
  if (job.job_salary_currency === 'USD') return Math.round((max * 83 * multiplier) / 100000);
  return null;
}

function defaultSkillsForRole(role: string) {
  const lower = role.toLowerCase();
  if (lower.includes('frontend')) return ['React', 'JavaScript', 'TypeScript', 'CSS', 'HTML', 'Git'];
  if (lower.includes('backend')) return ['Node.js', 'Express', 'PostgreSQL', 'REST API', 'Git', 'Docker'];
  if (lower.includes('data')) return ['Python', 'SQL', 'Pandas', 'NumPy', 'Machine Learning', 'Excel'];
  if (lower.includes('devops')) return ['Docker', 'Kubernetes', 'Linux', 'AWS', 'CI/CD', 'Git'];
  if (lower.includes('android')) return ['Kotlin', 'Android', 'Java', 'REST API', 'Git'];
  return ['React', 'Node.js', 'JavaScript', 'TypeScript', 'SQL', 'Git'];
}

function estimateSalaryForRole(role: string, raw: any): SalaryEstimate {
  const text = `${role} ${raw.title ?? raw.job_title ?? ''} ${raw.job_type ?? raw.job_employment_type ?? ''}`.toLowerCase();
  let min = 4;
  let max = 10;

  if (text.includes('intern')) {
    min = 1.2;
    max = 4;
  } else if (text.includes('data') || text.includes('machine learning') || text.includes('ml engineer')) {
    min = 6;
    max = 16;
  } else if (text.includes('devops') || text.includes('cloud') || text.includes('sre')) {
    min = 7;
    max = 18;
  } else if (text.includes('backend')) {
    min = 5;
    max = 14;
  } else if (text.includes('frontend')) {
    min = 4;
    max = 12;
  } else if (text.includes('full stack') || text.includes('fullstack') || text.includes('sde')) {
    min = 5;
    max = 15;
  } else if (text.includes('android') || text.includes('ios') || text.includes('mobile')) {
    min = 5;
    max = 13;
  }

  if (text.includes('senior') || text.includes('lead') || text.includes('staff')) {
    min += 8;
    max += 16;
  } else if (text.includes('sde 2') || text.includes('mid') || text.includes('3+') || text.includes('4+')) {
    min += 4;
    max += 8;
  } else if (text.includes('fresher') || text.includes('junior') || text.includes('entry')) {
    min = Math.max(2.5, min - 1);
    max = Math.max(min + 3, max - 4);
  }

  if (raw.is_remote || raw.job_is_remote) {
    min += 1;
    max += 2;
  }

  min = Math.round(min * 10) / 10;
  max = Math.round(max * 10) / 10;

  return {
    range: `Est. ₹${min}-${max} LPA`,
    min,
    max,
  };
}

function extractSkillsFromDescription(description: string, role: string): string[] {
  const lower = description.toLowerCase();
  const detected = SKILL_KEYWORDS.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
  return detected.length ? detected : defaultSkillsForRole(role);
}

function normalizeJobListing(raw: any, role = DEFAULT_ROLE): JobListing {
  const salaryEstimate = estimateSalaryForRole(role, raw);

  return {
    id: raw.id,
    external_id: String(raw.external_id ?? raw.job_id ?? `${raw.title ?? raw.job_title}-${raw.company ?? raw.employer_name}-${raw.location ?? raw.job_city}`),
    title: String(raw.title ?? raw.job_title ?? role),
    company: raw.company ?? raw.employer_name ?? null,
    location: raw.location ?? (raw.job_city ? `${raw.job_city}, ${raw.job_state ?? raw.job_country ?? 'India'}` : raw.job_country ?? 'India'),
    description: typeof raw.description === 'string' ? raw.description.slice(0, 2000) : raw.job_description?.slice(0, 2000) ?? null,
    skills_required: normalizeStringArray(raw.skills_required).length
      ? normalizeStringArray(raw.skills_required).slice(0, 12)
      : extractSkillsFromDescription(`${raw.title ?? raw.job_title ?? ''}\n${raw.description ?? raw.job_description ?? ''}`, role),
    apply_url: raw.apply_url ?? raw.job_apply_link ?? raw.job_google_link ?? null,
    salary_range: cleanSalaryRange(raw.salary_range) ?? formatSalaryRange(raw) ?? salaryEstimate.range,
    salary_lpa_min: positiveNumber(raw.salary_lpa_min) ?? normalizeSalaryMin(raw) ?? salaryEstimate.min,
    salary_lpa_max: positiveNumber(raw.salary_lpa_max) ?? normalizeSalaryMax(raw) ?? salaryEstimate.max,
    source: raw.source ?? 'jsearch',
    is_active: raw.is_active ?? true,
    posted_at: raw.posted_at ?? raw.job_posted_at_datetime_utc ?? new Date().toISOString(),
    fetched_at: raw.fetched_at ?? new Date().toISOString(),
    job_type: raw.job_type ?? raw.job_employment_type ?? 'Full-time',
    experience_required: raw.experience_required
      ?? (raw.job_required_experience?.required_experience_in_months
        ? `${Math.max(0, Math.round(raw.job_required_experience.required_experience_in_months / 12))} years`
        : 'Fresher/0-2 years'),
    is_remote: Boolean(raw.is_remote ?? raw.job_is_remote ?? false),
    company_logo: raw.company_logo ?? raw.employer_logo ?? null,
    highlights: normalizeHighlights(raw.highlights ?? raw.job_highlights),
    qualifications: raw.qualifications ?? (Array.isArray(raw.job_required_qualifications) ? raw.job_required_qualifications.join(', ') : null),
  };
}

function toDbRow(job: JobListing, includeEnrichedFields: boolean) {
  const base = {
    external_id: job.external_id,
    title: job.title,
    company: job.company,
    location: job.location,
    salary_range: job.salary_range,
    salary_lpa_min: job.salary_lpa_min,
    salary_lpa_max: job.salary_lpa_max,
    skills_required: job.skills_required,
    description: job.description,
    apply_url: job.apply_url,
    source: job.source,
    is_active: job.is_active,
    posted_at: job.posted_at,
    fetched_at: job.fetched_at,
  };

  if (!includeEnrichedFields) return base;

  return {
    ...base,
    job_type: job.job_type,
    experience_required: job.experience_required,
    is_remote: job.is_remote,
    company_logo: job.company_logo,
    qualifications: job.qualifications,
    highlights: job.highlights,
  };
}

async function upsertJobListings(jobs: JobListing[]) {
  const rows = jobs.map((job) => toDbRow(job, true));
  const enrichedResult = await supabaseAdmin
    .from('job_listings')
    .upsert(rows, { onConflict: 'external_id' });

  if (!enrichedResult.error) return;

  logger.warn({
    message: 'Enriched job upsert failed, retrying with base job columns',
    error: enrichedResult.error.message,
  });

  const fallbackRows = jobs.map((job) => toDbRow(job, false));
  const fallbackResult = await supabaseAdmin
    .from('job_listings')
    .upsert(fallbackRows, { onConflict: 'external_id' });

  if (fallbackResult.error) {
    logger.warn({
      message: 'Base job upsert failed',
      error: fallbackResult.error.message,
    });
  }
}

async function hydratePersistedIds(jobs: JobListing[]) {
  const externalIds = jobs.map((job) => job.external_id).filter(Boolean);
  if (!externalIds.length) return jobs;

  const { data, error } = await supabaseAdmin
    .from('job_listings')
    .select('*')
    .in('external_id', externalIds);

  if (error) {
    logger.warn({
      message: 'Unable to hydrate persisted job listing IDs',
      error: error.message,
    });
    return jobs;
  }

  const dbByExternalId = new Map((data ?? []).map((row: any) => [String(row.external_id), row]));
  return jobs.map((job) => {
    const persisted = dbByExternalId.get(job.external_id);
    return persisted
      ? { ...job, id: persisted.id ?? job.id }
      : job;
  });
}

async function fetchFromJSearch(role: string): Promise<JobListing[]> {
  const queries = [
    `${role} jobs India`,
    `${role} remote India`,
    `${role} fresher India`,
  ];

  const allJobs: JobListing[] = [];

  for (const query of queries) {
    try {
      const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
        params: {
          query,
          page: '1',
          num_pages: '2',
          date_posted: 'month',
          country: 'in',
          language: 'en',
        },
        headers: {
          'x-rapidapi-key': env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'jsearch.p.rapidapi.com',
        },
        timeout: 8000,
      });

      const jobs = (response.data?.data ?? []).map((job: any) => normalizeJobListing(job, role));
      allJobs.push(...jobs);
    } catch (error) {
      logger.warn({
        message: 'JSearch query failed',
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const unique = Array.from(
    new Map(allJobs.map((job) => [job.external_id, job])).values(),
  ).slice(0, 75);

  if (unique.length > 0) {
    await upsertJobListings(unique);
    return hydratePersistedIds(unique);
  }

  return [];
}

async function getOrFetchJobs(jobTitle: string, forceRefresh = false): Promise<JobListing[]> {
  const staleCutoff = new Date(Date.now() - CACHE_STALE_MS).toISOString();

  if (!forceRefresh) {
    const { data: cached, error } = await supabaseAdmin
      .from('job_listings')
      .select('*')
      .ilike('title', `%${jobTitle}%`)
      .eq('is_active', true)
      .gte('fetched_at', staleCutoff)
      .order('fetched_at', { ascending: false })
      .limit(60);

    if (!error && cached && cached.length >= 10) {
      return cached.map((job) => normalizeJobListing(job, jobTitle));
    }

    if (error) {
      logger.warn({
        message: 'Fresh job cache lookup failed',
        error: error.message,
      });
    }
  }

  const fresh = await fetchFromJSearch(jobTitle);
  if (fresh.length) return fresh;

  const { data: fallback, error: fallbackError } = await supabaseAdmin
    .from('job_listings')
    .select('*')
    .eq('is_active', true)
    .ilike('title', `%${jobTitle}%`)
    .order('fetched_at', { ascending: false })
    .limit(60);

  if (fallbackError) {
    logger.warn({
      message: 'Fallback job cache lookup failed',
      error: fallbackError.message,
    });
    return [];
  }

  return (fallback ?? []).map((job) => normalizeJobListing(job, jobTitle));
}

function generateMatchReason(fitPct: number, matchedSkills: string[], role: string): string {
  if (fitPct >= 80) return `Strong match - ${matchedSkills.slice(0, 2).join(', ') || role} align well`;
  if (fitPct >= 60) return `Good fit - ${matchedSkills[0] ?? role} experience valued`;
  if (fitPct >= 40) return `Stretch role - learn ${Math.max(1, 5 - matchedSkills.length)} more skills to qualify`;
  return `Growth opportunity - ${role} trajectory fits`;
}

function sortMatches<T extends { fit_percentage: number; job_listings: JobListing }>(matches: T[]) {
  return [...matches].sort((a, b) => {
    if (b.fit_percentage !== a.fit_percentage) return b.fit_percentage - a.fit_percentage;
    const salaryB = b.job_listings.salary_lpa_max ?? 0;
    const salaryA = a.job_listings.salary_lpa_max ?? 0;
    return salaryB - salaryA;
  });
}

export class HireMeService {
  private static async generateAIJobMatches(
    targetRole: string,
    skills: string[],
    location: string = 'India',
  ): Promise<any[]> {
    const system = `You are a job market expert for India's tech industry.
Generate realistic, current job listings. Return ONLY valid JSON array.`;

    const prompt = `Generate exactly 12 realistic job listings for:
Role: ${targetRole}
Skills: ${skills.slice(0, 10).join(', ')}
Location preference: ${location}

Return JSON array of 12 job objects:
[{
  "id": "ai-job-1",
  "title": "job title",
  "company": "real Indian tech company",
  "location": "Bengaluru / Mumbai / Hyderabad / Remote",
  "salary_min": 600000,
  "salary_max": 1200000,
  "job_type": "full-time",
  "experience_required": "0-2 years",
  "skills_required": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "description": "2 sentence job description",
  "apply_url": "https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(targetRole)}",
  "posted_date": "2026-04-28",
  "fit_percentage": 78,
  "match_reason": "why this is a good fit",
  "company_size": "1000-5000 employees",
  "company_type": "Product / Service / Startup"
}]

Use REAL Indian tech companies: Razorpay, Zepto, CRED, Meesho, Swiggy, PhonePe, Groww, Atlassian India, Freshworks, BrowserStack, Postman, Druva, Chargebee, Zoho, Infosys Digital, Wipro Elite, TCS iON, HCL Tech, Myntra, Flipkart, Amazon India, Microsoft India, Google India.`;

    return getClaudeJson<any[]>(system, prompt, []);
  }

  static async recalculateMatches(userId: string) {
    return this.getTopMatches(userId, 50, true);
  }

  static async getMatches(userId: string) {
    return this.getTopMatches(userId, 50);
  }

  static async getTopMatches(userId: string, limit = 50, forceRefresh = false) {
    const [{ data: userSkills, error: skillsError }, { data: targetRole }] = await Promise.all([
      supabaseAdmin
        .from('user_skills')
        .select('skill_name, proficiency_level')
        .eq('user_id', userId),
      supabaseAdmin
        .from('target_roles')
        .select('job_title')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (skillsError) throw new AppError(skillsError.message, 500, 'DB_ERROR');

    const role = (targetRole as TargetRoleRow | null)?.job_title ?? DEFAULT_ROLE;
    const userSkillRows = (userSkills ?? []) as UserSkillRow[];
    const userSkillList = userSkillRows.map((skill) => skill.skill_name).filter(Boolean);
    let jobs = await getOrFetchJobs(role, forceRefresh);
    if (jobs.length < 10) {
      const aiJobs = await HireMeService.generateAIJobMatches(
        role,
        userSkillList.length ? userSkillList : defaultSkillsForRole(role),
        'India',
      );
      const normalizedAIJobs = aiJobs.map((job, index) => normalizeJobListing({
        ...job,
        id: undefined,
        external_id: job.id ?? `ai-${role}-${index + 1}`,
        posted_at: job.posted_date,
        salary_lpa_min: positiveNumber(job.salary_min) ? Number(job.salary_min) / 100000 : null,
        salary_lpa_max: positiveNumber(job.salary_max) ? Number(job.salary_max) / 100000 : null,
        source: 'ai_generated',
      }, role));
      jobs = Array.from(new Map([...jobs, ...normalizedAIJobs].map((job) => [job.external_id, job])).values()).slice(0, 15);
    }
    const skillNames = new Set(userSkillRows.map((skill) => skill.skill_name.toLowerCase()));

    const candidates = jobs.map((job) => {
      const required = job.skills_required ?? [];
      const matched = required.filter((skill) => skillNames.has(skill.toLowerCase()));
      const missing = required.filter((skill) => !skillNames.has(skill.toLowerCase()));
      const fitPct = required.length > 0 ? Math.round((matched.length / required.length) * 100) : 60;
      const fitPercentage = Math.min(99, Math.max(20, fitPct));

      return {
        job,
        fit_percentage: fitPercentage,
        missing_skills: missing.slice(0, 5),
        next_steps: missing.slice(0, 3).map((skill) => `Practice ${skill} with one portfolio-quality project.`),
        match_reason: generateMatchReason(fitPercentage, matched, role),
      };
    });

    const persistable = candidates.filter((match) => match.job.id);
    if (persistable.length) {
      const rows = persistable.map((match) => ({
        user_id: userId,
        job_listing_id: match.job.id,
        fit_percentage: match.fit_percentage,
        missing_skills: match.missing_skills,
        next_steps: match.next_steps,
        match_reason: match.match_reason,
      }));

      const { error } = await supabaseAdmin
        .from('user_job_matches')
        .upsert(rows, { onConflict: 'user_id,job_listing_id' });

      if (error) {
        logger.warn({
          message: 'Unable to persist hire-me matches',
          error: error.message,
        });
      }
    }

    const jobIds = persistable.map((match) => match.job.id as string);
    if (!jobIds.length) {
      return sortMatches(candidates.map((match) => ({
        id: `job-${match.job.external_id}`,
        user_id: userId,
        job_listing_id: match.job.id ?? match.job.external_id,
        fit_percentage: match.fit_percentage,
        missing_skills: match.missing_skills,
        next_steps: match.next_steps,
        match_reason: match.match_reason,
        saved: false,
        applied: false,
        created_at: new Date().toISOString(),
        job_listings: match.job,
      }))).slice(0, limit);
    }

    const { data, error } = await supabaseAdmin
      .from('user_job_matches')
      .select('*, job_listings(*)')
      .eq('user_id', userId)
      .in('job_listing_id', jobIds);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    const freshJobById = new Map(persistable.map((match) => [match.job.id as string, match.job]));
    const normalizedMatches = (data ?? []).map((match: any) => {
      const enrichedJob = freshJobById.get(String(match.job_listing_id));
      const job = enrichedJob
        ? { ...normalizeJobListing(match.job_listings ?? {}, role), ...enrichedJob }
        : normalizeJobListing(match.job_listings ?? {}, role);

      return {
        ...match,
        missing_skills: normalizeStringArray(match.missing_skills),
        next_steps: normalizeStringArray(match.next_steps),
        job_listings: job,
      };
    });

    const ephemeralMatches = candidates
      .filter((match) => !match.job.id)
      .map((match) => ({
        id: `job-${match.job.external_id}`,
        user_id: userId,
        job_listing_id: match.job.external_id,
        fit_percentage: match.fit_percentage,
        missing_skills: match.missing_skills,
        next_steps: match.next_steps,
        match_reason: match.match_reason,
        saved: false,
        applied: false,
        created_at: new Date().toISOString(),
        job_listings: match.job,
      }));

    return sortMatches([...normalizedMatches, ...ephemeralMatches]).slice(0, limit);
  }

  static async getMatch(userId: string, jobId: string) {
    const { data, error } = await supabaseAdmin
      .from('user_job_matches')
      .select('*, job_listings(*)')
      .eq('user_id', userId)
      .eq('job_listing_id', jobId)
      .maybeSingle();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  static async updateSaved(userId: string, id: string, saved: boolean) {
    const { data, error } = await supabaseAdmin.from('user_job_matches').update({ saved }).eq('id', id).eq('user_id', userId).select().single();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  static async updateApplied(userId: string, id: string) {
    const { data, error } = await supabaseAdmin.from('user_job_matches').update({ applied: true }).eq('id', id).eq('user_id', userId).select().single();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data;
  }
}
