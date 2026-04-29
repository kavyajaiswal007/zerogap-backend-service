import { supabaseAdmin } from '../../config/supabase.js';
import { getActiveTargetRole, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';
import { JobMarketService } from '../jobMarket/jobMarket.service.js';

export class HireMeService {
  static async recalculateMatches(userId: string) {
    const targetRole = await getActiveTargetRole(userId);
    if (!targetRole) throw new AppError('Target role missing', 404, 'TARGET_ROLE_NOT_FOUND');
    const [skills, listingResult] = await Promise.all([
      getUserSkills(userId),
      supabaseAdmin.from('job_listings').select('*').eq('is_active', true).ilike('title', `%${targetRole.job_title}%`).limit(50),
    ]);

    let listings = listingResult.data ?? [];
    if (!listings.length) {
      await JobMarketService.refreshRole(targetRole.job_title);
      const refreshed = await supabaseAdmin.from('job_listings').select('*').eq('is_active', true).ilike('title', `%${targetRole.job_title}%`).limit(50);
      listings = refreshed.data ?? [];
    }

    const skillNames = new Set(skills.map((skill) => skill.skill_name.toLowerCase()));
    const matches = [];

    for (const listing of listings) {
      const required = (listing.skills_required ?? []) as string[];
      const matched = required.filter((skill) => skillNames.has(skill.toLowerCase()));
      const fit = required.length ? Number(((matched.length / required.length) * 100).toFixed(2)) : 0;
      const missingSkills = required.filter((skill) => !skillNames.has(skill.toLowerCase()));

      matches.push({
        user_id: userId,
        job_listing_id: listing.id,
        fit_percentage: fit,
        missing_skills: missingSkills,
        next_steps: missingSkills.slice(0, 3).map((skill) => `Practice ${skill} with one portfolio-quality project.`),
        match_reason: `${matched.length} required skills already overlap with the role.`,
      });
    }

    if (matches.length) {
      await supabaseAdmin.from('user_job_matches').upsert(matches, { onConflict: 'user_id,job_listing_id' });
    }

    return this.getMatches(userId);
  }

  static async getMatches(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('user_job_matches')
      .select('*, job_listings(*)')
      .eq('user_id', userId)
      .order('fit_percentage', { ascending: false })
      .limit(10);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  static async getMatch(userId: string, jobId: string) {
    const { data, error } = await supabaseAdmin.from('user_job_matches').select('*, job_listings(*)').eq('user_id', userId).eq('job_listing_id', jobId).maybeSingle();
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
