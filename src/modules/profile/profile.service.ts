import multer from 'multer';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../utils/error.util.js';
import { getProfileOrThrow, getUserSkills } from '../../utils/db.util.js';
import { syncGithubRepos } from '../../utils/github.util.js';
import { enrichProfileWithAI, scrapeLinkedInPublicProfile } from '../../utils/linkedin.util.js';
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

  static async importLinkedIn(userId: string, body: {
    linkedinUrl: string;
    targetRole?: string;
  }) {
    const { linkedinUrl, targetRole = 'Full Stack Developer' } = body;

    const linkedInData = await scrapeLinkedInPublicProfile(linkedinUrl);
    const enriched = await enrichProfileWithAI(linkedInData ?? {}, targetRole);

    const profileUpdate: Record<string, unknown> = {
      linkedin_url: linkedinUrl,
      updated_at: new Date().toISOString(),
    };

    if (linkedInData?.name) profileUpdate.full_name = linkedInData.name;
    if (linkedInData?.location) profileUpdate.location = linkedInData.location;
    if (linkedInData?.headline) profileUpdate.bio = linkedInData.headline;
    if (linkedInData?.education?.[0]) {
      const education = linkedInData.education[0];
      profileUpdate.college_name = education.institution;
      profileUpdate.degree = [education.degree, education.field].filter(Boolean).join(' ');
      profileUpdate.graduation_year = parseInt(education.year, 10) || new Date().getFullYear() + 1;
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);
    if (profileError) throw new AppError(profileError.message, 400);

    const linkedInSkills = linkedInData?.skills || [];
    const allSkills = [
      ...linkedInSkills.map((skill, i) => ({
        user_id: userId,
        skill_name: skill,
        proficiency_level: Math.max(60, 85 - i * 2),
        verified: false,
        proof_type: 'self_declared',
        last_updated: new Date().toISOString(),
      })),
      ...enriched.predictedSkills
        .filter((predictedSkill) => !linkedInSkills.some((skill) => skill.toLowerCase() === predictedSkill.skill_name.toLowerCase()))
        .map((predictedSkill) => ({
          user_id: userId,
          skill_name: predictedSkill.skill_name,
          proficiency_level: predictedSkill.proficiency_level,
          verified: false,
          proof_type: 'self_declared',
          last_updated: new Date().toISOString(),
        })),
    ];

    if (allSkills.length > 0) {
      const { error: skillsError } = await supabaseAdmin
        .from('user_skills')
        .upsert(allSkills, { onConflict: 'user_id,skill_name', ignoreDuplicates: false });
      if (skillsError) throw new AppError(skillsError.message, 400);
    }

    if (linkedInData?.certifications?.length) {
      const certs = linkedInData.certifications.map((cert) => ({
        user_id: userId,
        title: cert.name,
        issuer: cert.issuer,
        issue_date: cert.date,
        credential_url: null,
        verified: false,
      }));
      const { error: certError } = await supabaseAdmin
        .from('certificates')
        .upsert(certs, { onConflict: 'user_id,title', ignoreDuplicates: true });
      if (certError) throw new AppError(certError.message, 400);
    }

    void enqueueSkillAnalysis(userId).catch(() => {});

    return {
      linkedInData,
      enriched,
      skillsAdded: allSkills.length,
      certificationsAdded: linkedInData?.certifications?.length || 0,
    };
  }

  static async uploadResume(userId: string, buffer: Buffer, fileName: string) {
    const parsed = await parseResumeBuffer(buffer);
    const parsedAny = parsed as any;
    const basics = parsedAny.basics ?? {};
    const education = parsedAny.education ?? parsed.education ?? [];
    const skills = (parsedAny.skills ?? parsed.skills ?? []).map((skill: any) => ({
      name: skill.skill_name ?? skill.name,
      proficiency: skill.proficiency_level ?? skill.proficiency ?? 60,
    })).filter((skill: any) => skill.name);
    const certifications = parsedAny.certifications ?? parsed.certifications ?? [];

    if (parsed.name || parsed.email || basics.name || basics.email || education.length) {
      await supabaseAdmin.from('profiles').update({
        full_name: basics.name ?? parsed.name,
        email: basics.email ?? parsed.email,
        degree: education?.[0]?.degree,
        graduation_year: education?.[0]?.graduation_year ?? education?.[0]?.year,
        bio: parsedAny.summary,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
    }

    if (skills.length) {
      await supabaseAdmin.from('user_skills').upsert(
        skills.map((skill: any) => ({
          user_id: userId,
          skill_name: skill.name,
          proficiency_level: skill.proficiency,
          verified: false,
          proof_type: 'self_declared',
        })),
        { onConflict: 'user_id,skill_name' },
      );
    }

    if (certifications.length) {
      await supabaseAdmin.from('certificates').insert(
        certifications.map((certificate: any) => ({
          user_id: userId,
          title: certificate.title,
          issuer: certificate.issuer,
          credential_url: certificate.credential_url ?? certificate.url,
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
