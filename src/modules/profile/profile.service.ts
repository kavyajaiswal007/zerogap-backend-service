import multer from 'multer';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../utils/error.util.js';
import { getProfileOrThrow, getUserSkills } from '../../utils/db.util.js';
import { syncGithubRepos } from '../../utils/github.util.js';
import { importLinkedInData } from '../../utils/linkedin.util.js';
import { parseResumeBuffer } from '../../utils/resumeParser.util.js';
import { enqueueSkillAnalysis } from '../../queues/skillAnalysis.queue.js';
import { RoadmapService } from '../roadmap/roadmap.service.js';

export const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).optional(),
  avatar_url: z.string().url().optional(),
  role: z.enum(['student', 'college', 'recruiter', 'mentor', 'parent', 'admin']).optional(),
  college_name: z.string().optional(),
  degree: z.string().optional(),
  graduation_year: z.number().int().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  learning_style: z.string().optional(),
  time_availability_hours: z.number().int().optional(),
  github_username: z.string().optional(),
  linkedin_url: z.string().url().optional(),
  github_access_token: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
});

export const onboardingSchema = z.object({
  profile: updateProfileSchema.partial().optional(),
  target_role: z.object({
    job_title: z.string().min(2),
    specialization: z.string().optional(),
    experience_level: z.enum(['fresher', 'junior', 'mid', 'senior']).default('fresher'),
  }),
  skills: z.array(z.object({
    skill_name: z.string().min(2),
    proficiency_level: z.number().int().min(0).max(100),
  })).default([]),
});

export const skillSchema = z.object({
  skill_name: z.string().min(2),
  proficiency_level: z.number().int().min(0).max(100).default(50),
  verified: z.boolean().default(false),
  proof_type: z.enum(['github', 'certificate', 'project', 'self_declared']).default('self_declared'),
  proof_url: z.string().url().optional(),
});

export const certificateSchema = z.object({
  title: z.string().min(2),
  issuer: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  credential_url: z.string().url().optional(),
  file_url: z.string().url().optional(),
  skills_validated: z.array(z.string()).default([]),
  verified: z.boolean().default(false),
});

export class ProfileService {
  static async getOwnProfile(userId: string) {
    const [profile, roles, skills, certificates, githubProofs, xp] = await Promise.all([
      getProfileOrThrow(userId),
      supabaseAdmin.from('target_roles').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('user_skills').select('*').eq('user_id', userId).order('skill_name'),
      supabaseAdmin.from('certificates').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('github_proofs').select('*').eq('user_id', userId).order('last_synced', { ascending: false }),
      supabaseAdmin.from('user_xp').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    return {
      profile,
      target_roles: roles.data ?? [],
      skills: skills.data ?? [],
      certificates: certificates.data ?? [],
      github_proofs: githubProofs.data ?? [],
      xp: xp.data ?? null,
    };
  }

  static async updateProfile(userId: string, payload: z.infer<typeof updateProfileSchema>) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500, 'PROFILE_UPDATE_FAILED');
    return data;
  }

  static async completeOnboarding(userId: string, payload: z.infer<typeof onboardingSchema>) {
    if (payload.profile) {
      await this.updateProfile(userId, {
        ...payload.profile,
        onboarding_completed: true,
      } as any);
    } else {
      await this.updateProfile(userId, { onboarding_completed: true } as any);
    }

    await supabaseAdmin
      .from('target_roles')
      .update({ is_active: false })
      .eq('user_id', userId);

    const { data: targetRole, error: targetRoleError } = await supabaseAdmin
      .from('target_roles')
      .insert({ user_id: userId, ...payload.target_role, is_active: true })
      .select()
      .single();

    if (targetRoleError) throw new AppError(targetRoleError.message, 500, 'TARGET_ROLE_CREATE_FAILED');

    if (payload.skills.length) {
      await supabaseAdmin.from('user_skills').upsert(
        payload.skills.map((skill) => ({
          user_id: userId,
          ...skill,
          verified: false,
          proof_type: 'self_declared',
        })),
        { onConflict: 'user_id,skill_name' },
      );
    }

    await supabaseAdmin
      .from('roadmaps')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    await RoadmapService.generate(userId);
    await enqueueSkillAnalysis(userId);

    return {
      target_role: targetRole,
      skills: await getUserSkills(userId),
    };
  }

  static async syncGithub(userId: string, accessToken?: string) {
    const profile = await getProfileOrThrow(userId);
    const token = accessToken ?? profile.github_access_token;
    if (!token) {
      throw new AppError('GitHub access token missing in profile or request body', 400, 'GITHUB_TOKEN_MISSING');
    }
    const result = await syncGithubRepos(userId, token);

    if (result.skills.length) {
      await supabaseAdmin.from('user_skills').upsert(
        result.skills.map((skill) => ({
          user_id: userId,
          skill_name: skill,
          proficiency_level: 70,
          verified: true,
          proof_type: 'github',
        })),
        { onConflict: 'user_id,skill_name' },
      );
    }

    await enqueueSkillAnalysis(userId);
    return result;
  }

  static async importLinkedIn(userId: string, payload: any) {
    const data = await importLinkedInData(payload);
    await supabaseAdmin.from('profiles').update({
      linkedin_url: data.linkedinUrl,
      bio: data.summary ?? undefined,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    if (data.skills.length) {
      await supabaseAdmin.from('user_skills').upsert(
        data.skills.map((skill) => ({
          user_id: userId,
          skill_name: skill,
          proficiency_level: 60,
          verified: false,
          proof_type: 'self_declared',
        })),
        { onConflict: 'user_id,skill_name' },
      );
    }

    return data;
  }

  static async uploadResume(userId: string, buffer: Buffer, fileName: string) {
    const parsed = await parseResumeBuffer(buffer);

    if (parsed.name || parsed.email || parsed.education?.length) {
      await supabaseAdmin.from('profiles').update({
        full_name: parsed.name,
        email: parsed.email,
        degree: parsed.education?.[0]?.degree,
        graduation_year: parsed.education?.[0]?.year,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
    }

    if (parsed.skills?.length) {
      await supabaseAdmin.from('user_skills').upsert(
        parsed.skills.map((skill) => ({
          user_id: userId,
          skill_name: skill.name,
          proficiency_level: skill.proficiency,
          verified: false,
          proof_type: 'self_declared',
        })),
        { onConflict: 'user_id,skill_name' },
      );
    }

    if (parsed.certifications?.length) {
      await supabaseAdmin.from('certificates').insert(
        parsed.certifications.map((certificate) => ({
          user_id: userId,
          title: certificate.title,
          issuer: certificate.issuer,
          credential_url: certificate.credential_url,
        })),
      );
    }

    const { data: storageData } = await supabaseAdmin.storage.from('resumes').upload(`${userId}/${Date.now()}-${fileName}`, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

    await enqueueSkillAnalysis(userId);

    return {
      parsed,
      storage: storageData,
    };
  }
}
