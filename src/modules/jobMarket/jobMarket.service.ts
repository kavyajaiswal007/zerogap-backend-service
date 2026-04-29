import axios from 'axios';
import { supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { AppError } from '../../utils/error.util.js';

interface JobMarketSummary {
  top_skills: string[];
  top_companies: string[];
  demand_trend: string;
  avg_salary_lpa: number;
}

interface NormalizedListing {
  external_id: string;
  title: string;
  company: string | null;
  location: string;
  salary_range?: string;
  salary_lpa_min: number | null;
  salary_lpa_max: number | null;
  skills_required: string[];
  description: string;
  apply_url?: string;
  source: string;
  posted_at?: string;
  fetched_at: string;
}

function extractSkillsFromText(text: string) {
  const skillDictionary = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Next.js', 'Python', 'SQL', 'PostgreSQL', 'AWS', 'Docker', 'Git', 'Redis', 'Tailwind CSS', 'Express.js', 'Java', 'C++'];
  const lower = text.toLowerCase();
  return skillDictionary.filter((skill) => lower.includes(skill.toLowerCase()));
}

function parseSalaryToLpa(salaryText?: string) {
  if (!salaryText) return { min: null, max: null };
  const numbers = salaryText.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.length) return { min: null, max: null };
  return { min: numbers[0], max: numbers[numbers.length - 1] };
}

export class JobMarketService {
  static async fetchJSearchListings(role: string, location = 'India') {
    const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query: `${role} jobs in ${location}`,
        page: 1,
        num_pages: 1,
        country: location.toLowerCase() === 'india' ? 'in' : 'us',
        date_posted: 'all',
      },
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
        'x-rapidapi-key': env.RAPIDAPI_KEY,
      },
    });

    return data.data ?? [];
  }

  static async refreshRole(role: string, location = 'India') {
    const listings = await this.fetchJSearchListings(role, location);

    const normalizedListings: NormalizedListing[] = listings.map((job: any) => {
      const salary = parseSalaryToLpa(job.job_salary ?? job.job_min_salary?.toString());
      return {
        external_id: String(job.job_id),
        title: job.job_title,
        company: job.employer_name,
        location: job.job_city || job.job_country || location,
        salary_range: job.job_salary,
        salary_lpa_min: salary.min,
        salary_lpa_max: salary.max,
        skills_required: extractSkillsFromText(`${job.job_title}\n${job.job_description}`),
        description: job.job_description,
        apply_url: job.job_apply_link,
        source: 'jsearch',
        posted_at: job.job_posted_at_datetime_utc,
        fetched_at: new Date().toISOString(),
      };
    });

    if (normalizedListings.length) {
      await supabaseAdmin.from('job_listings').upsert(normalizedListings, { onConflict: 'external_id' });
    }

    const fallbackSummary: JobMarketSummary = {
      top_skills: [...new Set(normalizedListings.flatMap((job: NormalizedListing) => job.skills_required))].slice(0, 10),
      top_companies: [...new Set(normalizedListings.map((job: NormalizedListing) => job.company).filter((company): company is string => Boolean(company)))].slice(0, 10),
      demand_trend: normalizedListings.length > 25 ? 'high' : normalizedListings.length > 10 ? 'medium' : 'emerging',
      avg_salary_lpa: Number(((normalizedListings.reduce((sum: number, job: NormalizedListing) => sum + Number(job.salary_lpa_max ?? job.salary_lpa_min ?? 0), 0)) / Math.max(normalizedListings.length, 1)).toFixed(2)),
    };

    const summary = await getClaudeJson<JobMarketSummary>(
      'You analyze job market data for students targeting tech roles in India.',
      `Based on these job listings for ${role}, summarize top skills, salary range, and demand trend:\n${JSON.stringify(normalizedListings).slice(0, 12000)}`,
      fallbackSummary,
    );

    const { data, error } = await supabaseAdmin.from('job_market_cache').upsert({
      job_title: role,
      location,
      avg_salary_lpa: summary.avg_salary_lpa,
      demand_trend: summary.demand_trend,
      top_skills: summary.top_skills,
      top_companies: summary.top_companies,
      job_count: normalizedListings.length,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'job_title,location' }).select().single();

    if (error) {
      throw new AppError(error.message, 500, 'JOB_MARKET_REFRESH_FAILED');
    }

    return {
      cache: data,
      listings: normalizedListings,
    };
  }

  static async marketForRole(role: string, location = 'India') {
    const { data } = await supabaseAdmin.from('job_market_cache').select('*').eq('job_title', role).eq('location', location).maybeSingle();
    const isStale = !data || new Date(data.last_updated).getTime() < Date.now() - 24 * 60 * 60 * 1000;
    return isStale ? this.refreshRole(role, location) : { cache: data, listings: [] };
  }

  static async getListings(filters: { role?: string; location?: string; savedOnly?: boolean; userId?: string }) {
    let query = supabaseAdmin.from('job_listings').select('*').eq('is_active', true).order('fetched_at', { ascending: false });
    if (filters.role) query = query.ilike('title', `%${filters.role}%`);
    if (filters.location) query = query.ilike('location', `%${filters.location}%`);
    const { data, error } = await query.limit(50);
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }
}
