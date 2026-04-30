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

const STOCK_SKILLS = [
  { skill_name: 'React', proficiency_level: 65 },
  { skill_name: 'JavaScript', proficiency_level: 70 },
  { skill_name: 'TypeScript', proficiency_level: 55 },
];

const stockText = (fallback: string, min = 0) => z.preprocess((value) => {
  const text = String(value ?? '').trim();
  return text.length >= min ? text : fallback;
}, z.string());

const optionalText = z.preprocess((value) => {
  const text = String(value ?? '').trim();
  return text || undefined;
}, z.string().optional()).catch(undefined);

const optionalUrl = z.preprocess((value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return parsed.hostname.includes('.') ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}, z.string().url().optional()).catch(undefined);

const optionalInt = z.preprocess((value) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.round(next) : undefined;
}, z.number().int().optional()).catch(undefined);

export const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const updateProfileSchema = z.object({
  full_name: stockText('ZeroGap User', 2).optional(),
  avatar_url: optionalUrl,
  role: z.enum(['student', 'college', 'recruiter', 'mentor', 'parent', 'admin']).optional(),
  college_name: optionalText,
  degree: optionalText,
  graduation_year: optionalInt,
  location: optionalText,
  bio: optionalText,
  learning_style: optionalText,
  time_availability_hours: optionalInt,
  github_username: optionalText,
  linkedin_url: optionalUrl,
  github_access_token: optionalText,
  onboarding_completed: z.boolean().optional(),
});

export const onboardingSchema = z.object({
  profile: updateProfileSchema.partial().optional(),
  target_role: z.object({
    job_title: stockText('Full Stack Developer', 2),
    specialization: optionalText,
    experience_level: z.enum(['fresher', 'junior', 'mid', 'senior']).default('fresher'),
  }).default({ job_title: 'Full Stack Developer', experience_level: 'fresher' }),
  skills: z.array(z.object({
    skill_name: stockText('React', 2),
    proficiency_level: z.preprocess((value) => {
      const next = Number(value);
      return Number.isFinite(next) ? Math.min(100, Math.max(0, Math.round(next))) : 60;
    }, z.number().int().min(0).max(100)),
  })).default(STOCK_SKILLS).catch(STOCK_SKILLS),
});

export const skillSchema = z.object({
  skill_name: stockText('React', 2),
  proficiency_level: z.number().int().min(0).max(100).default(50),
  verified: z.boolean().default(false),
  proof_type: z.enum(['github', 'certificate', 'project', 'self_declared']).default('self_declared'),
  proof_url: z.string().url().optional(),
});

export const certificateSchema = z.object({
  title: stockText('ZeroGap Practice Certificate', 2),
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
    const profilePayload = {
      full_name: 'ZeroGap User',
      college_name: 'Independent learner',
      degree: 'B.Tech CSE',
      graduation_year: new Date().getFullYear() + 1,
      learning_style: 'project-based',
      time_availability_hours: 3,
      ...(payload.profile ?? {}),
      onboarding_completed: true,
    };

    await this.updateProfile(userId, profilePayload as any);

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

    const skills = payload.skills.length ? payload.skills : STOCK_SKILLS;

    if (skills.length) {
      await supabaseAdmin.from('user_skills').upsert(
        skills.map((skill) => ({
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
