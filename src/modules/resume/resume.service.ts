import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getActiveTargetRole, getProfileOrThrow, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';

export class ResumeService {
  static async generate(userId: string) {
    const [profile, targetRole, skills, proofs, certificates, completedTasks, market] = await Promise.all([
      getProfileOrThrow(userId),
      getActiveTargetRole(userId),
      getUserSkills(userId),
      supabaseAdmin.from('github_proofs').select('*').eq('user_id', userId),
      supabaseAdmin.from('certificates').select('*').eq('user_id', userId),
      supabaseAdmin.from('roadmap_tasks').select('*').eq('user_id', userId).eq('is_completed', true),
      supabaseAdmin.from('job_market_cache').select('*').limit(1),
    ]);

    const targetJobTitle = targetRole?.job_title ?? 'Software Engineer';
    const keywords = market.data?.[0]?.top_skills ?? [];
    const verifiedSkills = skills.filter((skill) => skill.verified);

    const fallback = {
      basics: {
        name: profile.full_name,
        email: profile.email,
        location: profile.location,
        summary: `${profile.full_name} is building toward a ${targetJobTitle} role with hands-on projects and measurable skill growth.`,
      },
      skills: verifiedSkills.map((skill) => skill.skill_name),
      projects: (proofs.data ?? []).slice(0, 3).map((proof) => ({
        name: proof.repo_name,
        summary: `Built ${proof.repo_name} demonstrating ${proof.skills_detected?.join(', ') ?? 'technical depth'}.`,
      })),
      certifications: certificates.data ?? [],
      experience: [],
    };

    const resumeJson = await getClaudeJson<any>(
      'You are an expert ATS resume writer for tech roles in India. Generate structured resume JSON.',
      `User data: ${JSON.stringify({
        profile,
        verifiedSkills,
        githubProofs: proofs.data,
        certificates: certificates.data,
        completedTasks: completedTasks.data,
        targetJobTitle,
        keywords,
      }).slice(0, 15000)}`,
      fallback,
    );

    const resumeText = JSON.stringify(resumeJson).toLowerCase();
    const keywordMatchScore = keywords.length
      ? Number((((keywords.filter((keyword: string) => resumeText.includes(keyword.toLowerCase())).length) / keywords.length) * 100).toFixed(2))
      : 0;
    const atsScore = Math.min(100, keywordMatchScore * 0.7 + verifiedSkills.length * 4 + ((proofs.data ?? []).length * 3));

    const { data: latest } = await supabaseAdmin.from('resumes').select('version').eq('user_id', userId).order('version', { ascending: false }).limit(1).maybeSingle();
    await supabaseAdmin.from('resumes').update({ is_latest: false }).eq('user_id', userId);

    const { data, error } = await supabaseAdmin.from('resumes').insert({
      user_id: userId,
      target_role_id: targetRole?.id ?? null,
      content_json: resumeJson,
      ats_score: Number(atsScore.toFixed(2)),
      keyword_match_score: keywordMatchScore,
      version: (latest?.version ?? 0) + 1,
      is_latest: true,
    }).select().single();

    if (error) throw new AppError(error.message, 500, 'RESUME_GENERATE_FAILED');
    return data;
  }

  static async latest(userId: string) {
    const { data, error } = await supabaseAdmin.from('resumes').select('*').eq('user_id', userId).eq('is_latest', true).maybeSingle();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  static async getById(userId: string, id: string) {
    const { data, error } = await supabaseAdmin.from('resumes').select('*').eq('user_id', userId).eq('id', id).single();
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  static async exportPdf(userId: string, id: string) {
    const resume = await this.getById(userId, id);
    const tempPath = path.join(os.tmpdir(), `resume-${id}.pdf`);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(tempPath);
      doc.pipe(stream);
      doc.fontSize(22).text(resume.content_json.basics?.name ?? 'ZeroGap Candidate');
      doc.moveDown();
      doc.fontSize(12).text(`Email: ${resume.content_json.basics?.email ?? ''}`);
      doc.text(`Location: ${resume.content_json.basics?.location ?? ''}`);
      doc.moveDown();
      doc.fontSize(16).text('Summary');
      doc.fontSize(12).text(resume.content_json.basics?.summary ?? '');
      doc.moveDown();
      doc.fontSize(16).text('Skills');
      doc.fontSize(12).text((resume.content_json.skills ?? []).join(', '));
      doc.moveDown();
      doc.fontSize(16).text('Projects');
      for (const project of resume.content_json.projects ?? []) {
        doc.fontSize(12).text(`${project.name}: ${project.summary}`);
      }
      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    const buffer = fs.readFileSync(tempPath);
    const storagePath = `${userId}/resume-${resume.version}.pdf`;
    const { data: storageData, error: uploadError } = await supabaseAdmin.storage.from('resumes').upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (uploadError) throw new AppError(uploadError.message, 500, 'PDF_UPLOAD_FAILED');

    const { data: publicUrl } = supabaseAdmin.storage.from('resumes').getPublicUrl(storagePath);
    await supabaseAdmin.from('resumes').update({ pdf_url: publicUrl.publicUrl }).eq('id', resume.id);

    return {
      ...storageData,
      pdf_url: publicUrl.publicUrl,
    };
  }
}
