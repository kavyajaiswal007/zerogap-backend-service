import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { sendSuccess } from '../../utils/api.util.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import {
  ProfileService,
  profileUpload,
  updateProfileSchema,
  onboardingSchema,
  skillSchema,
  certificateSchema,
} from './profile.service.js';

const deleteSkillParams = z.object({ skillId: z.string().uuid() });
const deleteCertificateParams = z.object({ id: z.string().uuid() });

export const profileRouter = Router();

profileRouter.get('/profile', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProfileService.getOwnProfile(req.user!.id), 'Profile fetched');
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/profile', requireAuth, validate(updateProfileSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProfileService.updateProfile(req.user!.id, req.body), 'Profile updated');
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/profile/onboarding', requireAuth, validate(onboardingSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProfileService.completeOnboarding(req.user!.id, req.body), 'Onboarding completed');
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/profile/github/sync', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProfileService.syncGithub(req.user!.id, req.body.accessToken), 'GitHub synced');
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/profile/linkedin/import', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await ProfileService.importLinkedIn(req.user!.id, req.body), 'LinkedIn imported');
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/profile/resume/upload', requireAuth, profileUpload.single('file'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) {
      throw new Error('Resume file is required');
    }
    sendSuccess(res, await ProfileService.uploadResume(req.user!.id, req.file.buffer, req.file.originalname), 'Resume uploaded and parsed');
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/profile/skills', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await ProfileService.getOwnProfile(req.user!.id);
    sendSuccess(res, data.skills, 'Skills fetched');
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/profile/skills', requireAuth, validate(skillSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await (await import('../../config/supabase.js')).supabaseAdmin
      .from('user_skills')
      .upsert({ user_id: req.user!.id, ...req.body, last_updated: new Date().toISOString() }, { onConflict: 'user_id,skill_name' })
      .select()
      .single();
    if (error) throw error;
    sendSuccess(res, data, 'Skill saved');
  } catch (error) {
    next(error);
  }
});

profileRouter.delete('/profile/skills/:skillId', requireAuth, validate(deleteSkillParams, 'params'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { error } = await (await import('../../config/supabase.js')).supabaseAdmin
      .from('user_skills')
      .delete()
      .eq('id', req.params.skillId)
      .eq('user_id', req.user!.id);
    if (error) throw error;
    sendSuccess(res, { deleted: true }, 'Skill removed');
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/profile/certificates', requireAuth, validate(certificateSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await (await import('../../config/supabase.js')).supabaseAdmin
      .from('certificates')
      .insert({ user_id: req.user!.id, ...req.body })
      .select()
      .single();
    if (error) throw error;
    sendSuccess(res, data, 'Certificate added', 201);
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/profile/certificates', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await ProfileService.getOwnProfile(req.user!.id);
    sendSuccess(res, data.certificates, 'Certificates fetched');
  } catch (error) {
    next(error);
  }
});

profileRouter.delete('/profile/certificates/:id', requireAuth, validate(deleteCertificateParams, 'params'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { error } = await (await import('../../config/supabase.js')).supabaseAdmin
      .from('certificates')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id);
    if (error) throw error;
    sendSuccess(res, { deleted: true }, 'Certificate removed');
  } catch (error) {
    next(error);
  }
});
