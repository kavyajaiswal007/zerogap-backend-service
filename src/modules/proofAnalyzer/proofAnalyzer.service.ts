import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getProfileOrThrow } from '../../utils/db.util.js';
import { syncGithubRepos } from '../../utils/github.util.js';
import { AppError } from '../../utils/error.util.js';

export class ProofAnalyzerService {
  static async analyzeGithub(userId: string) {
    const profile = await getProfileOrThrow(userId);
    if (!profile.github_access_token) {
      throw new AppError('GitHub access token missing', 400, 'GITHUB_TOKEN_MISSING');
    }
    const syncResult = await syncGithubRepos(userId, profile.github_access_token);
    const { data: proofs } = await supabaseAdmin.from('github_proofs').select('*').eq('user_id', userId);

    for (const proof of proofs ?? []) {
      const analysis = await getClaudeJson<any>(
        'Analyze GitHub repositories for employability proof.',
        `Analyze this GitHub repository. Identify: 1) Skills demonstrated, 2) Code complexity (0-100), 3) Project quality score (0-100), 4) Is this production-ready? 5) Missing best practices. Return JSON.\n${JSON.stringify(proof)}`,
        {
          skills: proof.skills_detected ?? [],
          code_complexity: proof.complexity_score ?? 50,
          project_quality_score: proof.quality_score ?? 60,
          production_ready: false,
          missing_best_practices: [],
        },
      );

      await supabaseAdmin.from('github_proofs').update({
        quality_score: analysis.project_quality_score,
        complexity_score: analysis.code_complexity,
        skills_detected: analysis.skills,
      }).eq('id', proof.id);

      await supabaseAdmin.from('user_skills').upsert(
        (analysis.skills ?? []).map((skill: string) => ({
          user_id: userId,
          skill_name: skill,
          proficiency_level: 75,
          verified: true,
          proof_type: 'github',
          proof_url: proof.repo_url,
        })),
        { onConflict: 'user_id,skill_name' },
      );
    }

    return {
      ...syncResult,
      analyzedRepos: proofs?.length ?? 0,
    };
  }

  static async analyzeCertificate(userId: string, payload: { title: string; url?: string; content?: string }) {
    const analysis = await getClaudeJson<any>(
      'Review certificates and infer validated skills.',
      `Verify this certificate and infer validated skills. Return JSON.\n${JSON.stringify(payload)}`,
      {
        verified: Boolean(payload.url),
        skills_validated: [],
        notes: 'Manual review recommended',
      },
    );

    const { data, error } = await supabaseAdmin.from('certificates').insert({
      user_id: userId,
      title: payload.title,
      credential_url: payload.url,
      skills_validated: analysis.skills_validated,
      verified: analysis.verified,
    }).select().single();
    if (error) throw new AppError(error.message, 500, 'CERTIFICATE_ANALYZE_FAILED');

    return { certificate: data, analysis };
  }

  static async getProofScore(userId: string) {
    const { data, error } = await supabaseAdmin.from('github_proofs').select('*').eq('user_id', userId);
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    const proofs = data ?? [];
    return {
      average_quality_score: proofs.length ? Number((proofs.reduce((sum, item) => sum + Number(item.quality_score ?? 0), 0) / proofs.length).toFixed(2)) : 0,
      average_complexity_score: proofs.length ? Number((proofs.reduce((sum, item) => sum + Number(item.complexity_score ?? 0), 0) / proofs.length).toFixed(2)) : 0,
      repos: proofs,
    };
  }
}
