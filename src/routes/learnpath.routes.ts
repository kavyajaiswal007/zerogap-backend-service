import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { certificateRateLimiter, quizSubmitRateLimiter } from '../middleware/rateLimit.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type {
  CertificateRow,
  LearnPathStats,
  LearningPathRow,
  PlaylistProgressData,
  PlaylistRow,
  PlaylistVideoRow,
  UserVideoProgressRow,
  VideoQuestionRow,
} from '../types/learnpath.types.js';
import { sendSuccess } from '../utils/api.util.js';
import { generateCertificatePDF } from '../utils/certificateGenerator.util.js';
import { AppError } from '../utils/error.util.js';
import { getCompletionMap, getEnrollmentMap, getRecommendedPlaylists } from '../utils/playlistRecommender.util.js';
import { generateQuestionsForVideo } from '../utils/quizGenerator.util.js';
import { AchievementsService } from '../modules/achievements/achievements.service.js';

export const learnPathRouter = Router();

const CERTIFICATE_BUCKET = 'certificates';
const CERTIFICATE_SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

interface EnrollmentJoinRow {
  playlist_id: string;
  completed_at: string | null;
  playlists: PlaylistRow | PlaylistRow[] | null;
}

interface CatalogQuery {
  category?: string;
  difficulty?: string;
  tag?: string;
  search?: string;
  page?: string;
  limit?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function routeParam(req: { params: Record<string, string | string[] | undefined> }, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function publicCertificate(certificate: CertificateRow, playlistTitle?: string) {
  return {
    id: certificate.id,
    playlist_id: certificate.playlist_id,
    playlist_title: playlistTitle ?? certificate.title,
    certificate_code: certificate.certificate_code,
    issued_at: certificate.issue_date ?? certificate.created_at,
    overall_quiz_score: certificate.overall_quiz_score ?? 0,
    total_watch_seconds: certificate.total_watch_seconds ?? 0,
    pdf_url: certificate.pdf_url ?? certificate.file_url ?? '',
  };
}

function parseAnswers(body: unknown): Record<string, string> {
  const answers = (body as { answers?: unknown }).answers;
  if (Array.isArray(answers)) {
    return answers.reduce<Record<string, string>>((acc, item) => {
      const row = item as { question_id?: unknown; selected_option_id?: unknown };
      if (row.question_id && row.selected_option_id) {
        acc[String(row.question_id)] = String(row.selected_option_id);
      }
      return acc;
    }, {});
  }

  if (answers && typeof answers === 'object') {
    return Object.fromEntries(
      Object.entries(answers as Record<string, unknown>).map(([questionId, selected]) => [questionId, String(selected)]),
    );
  }

  return {};
}

function shuffle<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

async function getPlaylistOrThrow(playlistId: string) {
  const { data, error } = await supabaseAdmin.from('playlists').select('*').eq('id', playlistId).maybeSingle();
  if (error) throw new AppError(error.message, 500, 'PLAYLIST_LOOKUP_FAILED');
  if (!data) throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  return data as PlaylistRow;
}

async function getVideoOrThrow(videoId: string) {
  const { data, error } = await supabaseAdmin.from('playlist_videos').select('*').eq('id', videoId).maybeSingle();
  if (error) throw new AppError(error.message, 500, 'VIDEO_LOOKUP_FAILED');
  if (!data) throw new AppError('Video not found', 404, 'VIDEO_NOT_FOUND');
  return data as PlaylistVideoRow;
}

async function getProgressRow(userId: string, videoId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_video_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, 'PROGRESS_LOOKUP_FAILED');
  return data as UserVideoProgressRow | null;
}

async function updateLearningStreak(userId: string) {
  await AchievementsService.updateStreak(userId);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin.from('learning_streaks').select('*').eq('user_id', userId).maybeSingle();
  const current = data as { current_streak?: number; longest_streak?: number; last_active_date?: string | null } | null;
  const nextCurrent = current?.last_active_date === today
    ? current.current_streak ?? 1
    : current?.last_active_date === yesterday
      ? (current.current_streak ?? 0) + 1
      : 1;

  await supabaseAdmin.from('learning_streaks').upsert({
    user_id: userId,
    current_streak: nextCurrent,
    longest_streak: Math.max(nextCurrent, current?.longest_streak ?? 0),
    last_active_date: today,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function maybeCompleteEnrollment(userId: string, playlistId: string) {
  const progress = await getPlaylistProgress(userId, playlistId);
  if (!progress.is_eligible_for_certificate) {
    return progress;
  }

  await supabaseAdmin
    .from('user_playlist_enrollments')
    .update({ completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('playlist_id', playlistId)
    .is('completed_at', null);

  return progress;
}

async function getPlaylistProgress(userId: string, playlistId: string): Promise<PlaylistProgressData> {
  const playlist = await getPlaylistOrThrow(playlistId);
  const [videosResult, progressResult, notesResult] = await Promise.all([
    supabaseAdmin.from('playlist_videos').select('*').eq('playlist_id', playlistId).order('position'),
    supabaseAdmin.from('user_video_progress').select('*').eq('user_id', userId).eq('playlist_id', playlistId),
    supabaseAdmin.from('user_video_notes').select('video_id, note_text').eq('user_id', userId).eq('playlist_id', playlistId),
  ]);

  if (videosResult.error) throw new AppError(videosResult.error.message, 500, 'VIDEOS_LOOKUP_FAILED');
  if (progressResult.error) throw new AppError(progressResult.error.message, 500, 'PROGRESS_LOOKUP_FAILED');
  if (notesResult.error) throw new AppError(notesResult.error.message, 500, 'NOTES_LOOKUP_FAILED');

  const progressByVideo = new Map((progressResult.data as UserVideoProgressRow[] | null ?? []).map((row) => [row.video_id, row]));
  const notesByVideo = new Map((notesResult.data ?? []).map((row) => [String(row.video_id), String(row.note_text ?? '')]));
  const videos = (videosResult.data as PlaylistVideoRow[] | null ?? []).map((video) => {
    const row = progressByVideo.get(video.id);
    return {
      ...video,
      progress: {
        watch_seconds: row?.watch_seconds ?? 0,
        is_watch_complete: row?.is_watch_complete ?? false,
        quiz_passed: row?.quiz_passed ?? false,
        quiz_score: row?.quiz_score ?? null,
      },
      note_text: notesByVideo.get(video.id) ?? '',
    };
  });

  const blockers = videos
    .filter((video) => !video.progress.is_watch_complete || !video.progress.quiz_passed)
    .map((video) => `Video ${video.position}: ${video.title}`);
  const completedVideos = videos.filter((video) => video.progress.is_watch_complete && video.progress.quiz_passed).length;

  return {
    playlist,
    videos,
    completed_videos: completedVideos,
    total_videos: videos.length,
    playlist_completion_percentage: videos.length ? Math.round((completedVideos / videos.length) * 100) : 0,
    is_eligible_for_certificate: videos.length > 0 && blockers.length === 0,
    blockers,
  };
}

async function signedCertificateUrl(certificate: CertificateRow) {
  if (!certificate.pdf_storage_path) {
    return certificate.pdf_url ?? certificate.file_url ?? '';
  }

  const { data, error } = await supabaseAdmin
    .storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(certificate.pdf_storage_path, CERTIFICATE_SIGNED_URL_SECONDS);

  return error ? (certificate.pdf_url ?? certificate.file_url ?? '') : data.signedUrl;
}

function makeCertificateCode() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ZG-${year}-${random}`;
}

learnPathRouter.get('/verify/:certificateCode', async (req, res, next) => {
  try {
    const certificateCode = routeParam(req, 'certificateCode');
    const { data: certificate, error } = await supabaseAdmin
      .from('certificates')
      .select('id, user_id, title, issue_date, created_at, certificate_code, overall_quiz_score, playlist_id')
      .eq('certificate_code', certificateCode)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500, 'CERTIFICATE_VERIFY_FAILED');
    if (!certificate) throw new AppError('Certificate not found', 404, 'CERTIFICATE_NOT_FOUND');

    const [profileResult, playlistResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name').eq('id', certificate.user_id).maybeSingle(),
      certificate.playlist_id
        ? supabaseAdmin.from('playlists').select('title').eq('id', certificate.playlist_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileResult.error) throw new AppError(profileResult.error.message, 500, 'CERTIFICATE_VERIFY_FAILED');
    if (playlistResult.error) throw new AppError(playlistResult.error.message, 500, 'CERTIFICATE_VERIFY_FAILED');

    sendSuccess(res, {
      user_name: profileResult.data?.full_name ?? 'ZeroGap Learner',
      playlist_title: playlistResult.data?.title ?? certificate.title,
      issued_at: certificate.issue_date ?? certificate.created_at,
      score: certificate.overall_quiz_score ?? 0,
    }, 'Certificate verified');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.use(requireAuth);

learnPathRouter.get('/recommended', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await getRecommendedPlaylists(req.user!.id), 'Recommended playlists fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/catalog', async (req: AuthenticatedRequest, res, next) => {
  try {
    const queryParams = req.query as CatalogQuery;
    const page = clamp(Number(queryParams.page ?? 1) || 1, 1, 500);
    const limit = clamp(Number(queryParams.limit ?? 20) || 20, 1, 50);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('playlists')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.category) query = query.eq('category', queryParams.category);
    if (queryParams.difficulty) query = query.eq('difficulty', queryParams.difficulty);
    if (queryParams.tag) query = query.contains('skill_tags', [queryParams.tag]);
    if (queryParams.search) {
      const term = String(queryParams.search).replace(/[%_,]/g, ' ').trim();
      if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,channel_name.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(error.message, 500, 'CATALOG_LOOKUP_FAILED');

    const playlists = (data ?? []) as PlaylistRow[];
    const [enrollments, completionMap] = await Promise.all([
      getEnrollmentMap(req.user!.id),
      getCompletionMap(req.user!.id, playlists.map((playlist) => playlist.id)),
    ]);

    sendSuccess(res, {
      playlists: playlists.map((playlist) => ({
        ...playlist,
        is_enrolled: enrollments.has(playlist.id),
        completion_percentage: completionMap.get(playlist.id) ?? 0,
      })),
      total: count ?? playlists.length,
    }, 'Playlist catalog fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.post('/enroll/:playlistId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const playlistId = routeParam(req, 'playlistId');
    await getPlaylistOrThrow(playlistId);
    const { error } = await supabaseAdmin.from('user_playlist_enrollments').upsert({
      user_id: req.user!.id,
      playlist_id: playlistId,
      is_recommended: Boolean(req.body?.is_recommended),
    }, { onConflict: 'user_id,playlist_id' });

    if (error) throw new AppError(error.message, 500, 'ENROLLMENT_FAILED');
    await updateLearningStreak(req.user!.id);
    sendSuccess(res, { enrolled: true }, 'Playlist enrolled', 201);
  } catch (error) {
    next(error);
  }
});

learnPathRouter.delete('/enroll/:playlistId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const playlistId = routeParam(req, 'playlistId');
    const { data, error } = await supabaseAdmin
      .from('user_playlist_enrollments')
      .select('completed_at')
      .eq('user_id', req.user!.id)
      .eq('playlist_id', playlistId)
      .maybeSingle();
    if (error) throw new AppError(error.message, 500, 'ENROLLMENT_LOOKUP_FAILED');
    if (data?.completed_at) throw new AppError('Completed playlists cannot be unenrolled', 409, 'PLAYLIST_ALREADY_COMPLETED');

    const deleteResult = await supabaseAdmin
      .from('user_playlist_enrollments')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('playlist_id', playlistId);
    if (deleteResult.error) throw new AppError(deleteResult.error.message, 500, 'UNENROLL_FAILED');
    sendSuccess(res, { enrolled: false }, 'Playlist unenrolled');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/enrolled', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_playlist_enrollments')
      .select('playlist_id, completed_at, playlists(*)')
      .eq('user_id', req.user!.id)
      .order('enrolled_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'ENROLLED_LOOKUP_FAILED');

    const rows = (data ?? []) as EnrollmentJoinRow[];
    const playlists = rows.map((row) => one(row.playlists)).filter((playlist): playlist is PlaylistRow => Boolean(playlist));
    const completionMap = await getCompletionMap(req.user!.id, playlists.map((playlist) => playlist.id));
    sendSuccess(res, playlists.map((playlist) => ({
      ...playlist,
      is_enrolled: true,
      completion_percentage: completionMap.get(playlist.id) ?? 0,
    })), 'Enrolled playlists fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.post('/progress/watch', async (req: AuthenticatedRequest, res, next) => {
  try {
    const videoId = String(req.body?.video_id ?? '');
    const secondsWatched = clamp(Math.round(Number(req.body?.seconds_watched ?? 0)), 0, 600);
    if (!videoId || !secondsWatched) throw new AppError('video_id and seconds_watched are required', 400, 'INVALID_PROGRESS_PAYLOAD');

    const video = await getVideoOrThrow(videoId);
    const existing = await getProgressRow(req.user!.id, videoId);
    const watchSeconds = (existing?.watch_seconds ?? 0) + secondsWatched;
    const isWatchComplete = watchSeconds >= Math.round(video.duration_seconds * 0.8);
    const newlyCompleted = isWatchComplete && !existing?.is_watch_complete;

    const { data, error } = await supabaseAdmin.from('user_video_progress').upsert({
      user_id: req.user!.id,
      video_id: video.id,
      playlist_id: video.playlist_id,
      watch_seconds: watchSeconds,
      is_watch_complete: isWatchComplete,
      quiz_attempts: existing?.quiz_attempts ?? 0,
      quiz_score: existing?.quiz_score ?? null,
      quiz_passed: existing?.quiz_passed ?? false,
      completed_at: existing?.completed_at ?? null,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' }).select().single();

    if (error) throw new AppError(error.message, 500, 'WATCH_PROGRESS_FAILED');
    await updateLearningStreak(req.user!.id);
    if (newlyCompleted) await AchievementsService.awardXP(req.user!.id, 10);
    sendSuccess(res, data, 'Watch progress saved');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/progress/:playlistId', async (req: AuthenticatedRequest, res, next) => {
  try {
    sendSuccess(res, await getPlaylistProgress(req.user!.id, routeParam(req, 'playlistId')), 'Playlist progress fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/quiz/:videoId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const video = await getVideoOrThrow(routeParam(req, 'videoId'));
    const progress = await getProgressRow(req.user!.id, video.id);
    if (!progress?.is_watch_complete) throw new AppError('Watch at least 80% of this video before taking the quiz', 403, 'WATCH_REQUIRED');

    const playlist = await getPlaylistOrThrow(video.playlist_id);
    const questions = await generateQuestionsForVideo(video, playlist);
    sendSuccess(res, shuffle(questions).map((question) => ({
      id: question.id,
      question_text: question.question_text,
      options: shuffle(question.options),
      position: question.position,
    })), 'Quiz fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.post('/quiz/:videoId/submit', quizSubmitRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const video = await getVideoOrThrow(routeParam(req, 'videoId'));
    const progress = await getProgressRow(req.user!.id, video.id);
    if (!progress?.is_watch_complete) throw new AppError('Watch at least 80% of this video before submitting the quiz', 403, 'WATCH_REQUIRED');

    const answers = parseAnswers(req.body);
    const { data, error } = await supabaseAdmin
      .from('video_questions')
      .select('*')
      .eq('video_id', video.id)
      .order('position');
    if (error) throw new AppError(error.message, 500, 'QUIZ_LOOKUP_FAILED');

    const questions = (data ?? []) as VideoQuestionRow[];
    if (!questions.length) throw new AppError('Quiz questions are not ready yet', 409, 'QUIZ_NOT_READY');
    const correctCount = questions.filter((question) => answers[question.id] === question.correct_option_id).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 80;
    const bestScore = Math.max(score, progress.quiz_score ?? 0);
    const newlyPassed = passed && !progress.quiz_passed;

    const updateResult = await supabaseAdmin.from('user_video_progress').upsert({
      user_id: req.user!.id,
      video_id: video.id,
      playlist_id: video.playlist_id,
      watch_seconds: progress.watch_seconds,
      is_watch_complete: true,
      quiz_attempts: (progress.quiz_attempts ?? 0) + 1,
      quiz_score: bestScore,
      quiz_passed: progress.quiz_passed || passed,
      completed_at: progress.completed_at ?? (passed ? new Date().toISOString() : null),
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' });
    if (updateResult.error) throw new AppError(updateResult.error.message, 500, 'QUIZ_PROGRESS_FAILED');

    await updateLearningStreak(req.user!.id);
    if (newlyPassed) await AchievementsService.awardXP(req.user!.id, 25);
    if (passed) await maybeCompleteEnrollment(req.user!.id, video.playlist_id);

    sendSuccess(res, {
      score,
      passed,
      correct_count: correctCount,
      total: questions.length,
      explanations: questions.map((question) => ({
        question_id: question.id,
        explanation: question.explanation ?? '',
        correct_option_id: question.correct_option_id,
      })),
    }, 'Quiz submitted');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/certificate/:playlistId/check', async (req: AuthenticatedRequest, res, next) => {
  try {
    const progress = await getPlaylistProgress(req.user!.id, routeParam(req, 'playlistId'));
    sendSuccess(res, {
      eligible: progress.is_eligible_for_certificate,
      blockers: progress.blockers,
      videos: progress.videos.map((video) => ({
        id: video.id,
        title: video.title,
        position: video.position,
        watch_complete: video.progress.is_watch_complete,
        quiz_passed: video.progress.quiz_passed,
        quiz_score: video.progress.quiz_score,
      })),
    }, 'Certificate eligibility checked');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.post('/certificate/:playlistId/generate', certificateRateLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const playlistId = routeParam(req, 'playlistId');
    const progress = await getPlaylistProgress(req.user!.id, playlistId);
    if (!progress.is_eligible_for_certificate) {
      throw new AppError('Complete every video and pass every quiz first', 409, 'CERTIFICATE_NOT_ELIGIBLE');
    }

    const existingResult = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('playlist_id', playlistId)
      .maybeSingle();
    if (existingResult.error) throw new AppError(existingResult.error.message, 500, 'CERTIFICATE_LOOKUP_FAILED');

    if (existingResult.data) {
      const certificate = existingResult.data as CertificateRow;
      const signedUrl = await signedCertificateUrl(certificate);
      sendSuccess(res, publicCertificate({ ...certificate, pdf_url: signedUrl }, progress.playlist.title), 'Certificate fetched');
      return;
    }

    const profileResult = await supabaseAdmin.from('profiles').select('full_name').eq('id', req.user!.id).maybeSingle();
    if (profileResult.error) throw new AppError(profileResult.error.message, 500, 'PROFILE_LOOKUP_FAILED');

    const code = makeCertificateCode();
    const scoreValues = progress.videos.map((video) => video.progress.quiz_score ?? 0);
    const averageScore = scoreValues.reduce((sum, value) => sum + value, 0) / Math.max(scoreValues.length, 1);
    const watchSeconds = progress.videos.reduce((sum, video) => sum + video.progress.watch_seconds, 0);
    const issuedAt = new Date();
    const pdf = await generateCertificatePDF({
      userName: profileResult.data?.full_name ?? 'ZeroGap Learner',
      playlistTitle: progress.playlist.title,
      score: averageScore,
      watchSeconds,
      code,
      issuedAt,
    });

    const storagePath = `${req.user!.id}/${playlistId}.pdf`;
    const upload = await supabaseAdmin.storage.from(CERTIFICATE_BUCKET).upload(storagePath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    const signedUrl = upload.error
      ? ''
      : (await supabaseAdmin.storage.from(CERTIFICATE_BUCKET).createSignedUrl(storagePath, CERTIFICATE_SIGNED_URL_SECONDS)).data?.signedUrl ?? '';

    const { data, error } = await supabaseAdmin.from('certificates').insert({
      user_id: req.user!.id,
      playlist_id: playlistId,
      title: progress.playlist.title,
      issuer: 'ZeroGap',
      issue_date: issuedAt.toISOString().slice(0, 10),
      credential_url: `https://zerogap.io/verify/${code}`,
      file_url: signedUrl,
      skills_validated: progress.playlist.skill_tags,
      verified: true,
      certificate_code: code,
      overall_quiz_score: averageScore,
      total_watch_seconds: watchSeconds,
      pdf_url: signedUrl,
      pdf_storage_path: upload.error ? null : storagePath,
    }).select().single();
    if (error) throw new AppError(error.message, 500, 'CERTIFICATE_CREATE_FAILED');

    await AchievementsService.awardXP(req.user!.id, 200);
    sendSuccess(res, publicCertificate(data as CertificateRow, progress.playlist.title), 'Certificate generated', 201);
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/certificate/:playlistId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const playlistId = routeParam(req, 'playlistId');
    const [certificateResult, playlist] = await Promise.all([
      supabaseAdmin
        .from('certificates')
        .select('*')
        .eq('user_id', req.user!.id)
        .eq('playlist_id', playlistId)
        .maybeSingle(),
      getPlaylistOrThrow(playlistId),
    ]);
    if (certificateResult.error) throw new AppError(certificateResult.error.message, 500, 'CERTIFICATE_LOOKUP_FAILED');
    if (!certificateResult.data) throw new AppError('Certificate not found', 404, 'CERTIFICATE_NOT_FOUND');
    const certificate = certificateResult.data as CertificateRow;
    const signedUrl = await signedCertificateUrl(certificate);
    sendSuccess(res, publicCertificate({ ...certificate, pdf_url: signedUrl }, playlist.title), 'Certificate fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/certificates', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('certificates')
      .select('*, playlists(title)')
      .eq('user_id', req.user!.id)
      .not('playlist_id', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'CERTIFICATES_LOOKUP_FAILED');

    const certificates = await Promise.all((data ?? []).map(async (row) => {
      const certificate = row as CertificateRow & { playlists?: { title?: string } | { title?: string }[] | null };
      const signedUrl = await signedCertificateUrl(certificate);
      return publicCertificate({ ...certificate, pdf_url: signedUrl }, one(certificate.playlists)?.title);
    }));

    sendSuccess(res, certificates, 'Certificates fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/stats', async (req: AuthenticatedRequest, res, next) => {
  try {
    const [enrollments, certificates, progress, xp, streak] = await Promise.all([
      supabaseAdmin.from('user_playlist_enrollments').select('id', { count: 'exact', head: true }).eq('user_id', req.user!.id),
      supabaseAdmin.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', req.user!.id).not('playlist_id', 'is', null),
      supabaseAdmin.from('user_video_progress').select('watch_seconds').eq('user_id', req.user!.id),
      supabaseAdmin.from('user_xp').select('total_xp, current_streak_days, longest_streak_days').eq('user_id', req.user!.id).maybeSingle(),
      supabaseAdmin.from('learning_streaks').select('current_streak, longest_streak').eq('user_id', req.user!.id).maybeSingle(),
    ]);

    const totalSeconds = (progress.data ?? []).reduce((sum, row) => sum + Number(row.watch_seconds ?? 0), 0);
    const data: LearnPathStats = {
      enrolled_count: enrollments.count ?? 0,
      certificates_earned: certificates.count ?? 0,
      total_watch_hours: Math.round(totalSeconds / 360) / 10,
      total_xp: Number(xp.data?.total_xp ?? 0),
      current_streak: Number(streak.data?.current_streak ?? xp.data?.current_streak_days ?? 0),
      longest_streak: Number(streak.data?.longest_streak ?? xp.data?.longest_streak_days ?? 0),
    };

    sendSuccess(res, data, 'LearnPath stats fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/notes/:videoId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const video = await getVideoOrThrow(routeParam(req, 'videoId'));
    const { data, error } = await supabaseAdmin
      .from('user_video_notes')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('video_id', video.id)
      .maybeSingle();
    if (error) throw new AppError(error.message, 500, 'NOTE_LOOKUP_FAILED');
    sendSuccess(res, data ?? { video_id: video.id, playlist_id: video.playlist_id, note_text: '' }, 'Video note fetched');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.put('/notes/:videoId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const video = await getVideoOrThrow(routeParam(req, 'videoId'));
    const noteText = String(req.body?.note_text ?? '').slice(0, 12_000);
    const { data, error } = await supabaseAdmin.from('user_video_notes').upsert({
      user_id: req.user!.id,
      video_id: video.id,
      playlist_id: video.playlist_id,
      note_text: noteText,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' }).select().single();
    if (error) throw new AppError(error.message, 500, 'NOTE_SAVE_FAILED');
    sendSuccess(res, data, 'Video note saved');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/notes/:playlistId/export', async (req: AuthenticatedRequest, res, next) => {
  try {
    const progress = await getPlaylistProgress(req.user!.id, routeParam(req, 'playlistId'));
    const body = progress.videos
      .map((video) => `Video ${video.position}: ${video.title}\n${video.note_text ?? ''}`.trim())
      .join('\n\n---\n\n');
    sendSuccess(res, { filename: `${progress.playlist.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-notes.txt`, content: body }, 'Notes exported');
  } catch (error) {
    next(error);
  }
});

learnPathRouter.get('/paths', async (_req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_paths')
      .select('*, learning_path_playlists(step_number, playlists(*))')
      .order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500, 'PATHS_LOOKUP_FAILED');
    sendSuccess(res, data as LearningPathRow[], 'Learning paths fetched');
  } catch (error) {
    next(error);
  }
});
