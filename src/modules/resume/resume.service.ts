import PDFDocument from 'pdfkit';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeJson } from '../../utils/claude.util.js';
import { getActiveTargetRole, getProfileOrThrow, getUserSkills } from '../../utils/db.util.js';
import { AppError } from '../../utils/error.util.js';
import { logger } from '../../utils/logger.util.js';

const importDynamic = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

function text(value: unknown, fallback = '') {
  return String(value ?? fallback);
}

function escapeHtml(value: unknown) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeContent(content: any) {
  return {
    basics: {
      name: content?.basics?.name ?? content?.name ?? 'ZeroGap Candidate',
      email: content?.basics?.email ?? content?.email ?? '',
      phone: content?.basics?.phone ?? content?.phone ?? '',
      location: content?.basics?.location ?? content?.location ?? '',
      linkedin: content?.basics?.linkedin ?? content?.linkedin ?? '',
      github: content?.basics?.github ?? content?.github ?? '',
      summary: content?.basics?.summary ?? content?.summary ?? '',
    },
    skills: Array.isArray(content?.skills) ? content.skills : [],
    projects: Array.isArray(content?.projects) ? content.projects : [],
    experience: Array.isArray(content?.experience) ? content.experience : [],
    education: Array.isArray(content?.education) ? content.education : [],
    certifications: Array.isArray(content?.certifications) ? content.certifications : [],
  };
}

function itemPoints(item: any) {
  if (Array.isArray(item?.points)) return item.points;
  if (Array.isArray(item?.highlights)) return item.highlights;
  if (item?.summary) return [item.summary];
  if (item?.description) return [item.description];
  return [];
}

function buildResumeHTML(contentJson: any) {
  const content = normalizeContent(contentJson);
  const contact = [
    content.basics.email,
    content.basics.phone,
    content.basics.location,
    content.basics.linkedin,
    content.basics.github,
  ].filter(Boolean).map(escapeHtml).join(' | ');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: Inter, "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; padding: 28px; font-size: 12px; line-height: 1.45; }
    h1 { margin: 0; font-size: 26px; line-height: 1.1; color: #0f172a; }
    h2 { margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid #c7d2fe; color: #4f46e5; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
    p { margin: 0 0 6px; }
    ul { margin: 4px 0 0 16px; padding: 0; }
    li { margin: 2px 0; }
    .contact { color: #64748b; margin-top: 6px; font-size: 11px; }
    .section-item { margin-bottom: 10px; page-break-inside: avoid; }
    .item-title { font-weight: 700; color: #1f2937; }
    .item-sub { color: #64748b; font-size: 11px; }
    .skills { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill { background: #eef2ff; color: #4338ca; border-radius: 999px; padding: 3px 9px; font-size: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${escapeHtml(content.basics.name)}</h1>
  <div class="contact">${contact}</div>
  ${content.basics.summary ? `<h2>Summary</h2><p>${escapeHtml(content.basics.summary)}</p>` : ''}
  ${content.skills.length ? `<h2>Skills</h2><div class="skills">${content.skills.map((skill: any) => `<span class="skill">${escapeHtml(typeof skill === 'string' ? skill : skill.skill_name ?? skill.name)}</span>`).join('')}</div>` : ''}
  ${content.experience.length ? `<h2>Experience</h2>${content.experience.map((exp: any) => `
    <div class="section-item">
      <div class="item-title">${escapeHtml(exp.title ?? exp.role ?? 'Experience')} ${exp.company ? `- ${escapeHtml(exp.company)}` : ''}</div>
      <div class="item-sub">${escapeHtml(exp.duration ?? exp.period ?? '')}</div>
      <ul>${itemPoints(exp).map((point: string) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
    </div>
  `).join('')}` : ''}
  ${content.projects.length ? `<h2>Projects</h2>${content.projects.map((project: any) => `
    <div class="section-item">
      <div class="item-title">${escapeHtml(project.name ?? 'Project')} ${Array.isArray(project.tech) ? `<span class="item-sub">[${project.tech.map(escapeHtml).join(', ')}]</span>` : ''}</div>
      <ul>${itemPoints(project).map((point: string) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
    </div>
  `).join('')}` : ''}
  ${content.education.length ? `<h2>Education</h2>${content.education.map((edu: any) => `
    <div class="section-item">
      <div class="item-title">${escapeHtml(edu.degree ?? 'Degree')} ${edu.institution ? `- ${escapeHtml(edu.institution)}` : ''}</div>
      <div class="item-sub">${escapeHtml(edu.year ?? '')} ${edu.score ? `| ${escapeHtml(edu.score)}` : ''}</div>
    </div>
  `).join('')}` : ''}
  ${content.certifications.length ? `<h2>Certifications</h2><ul>${content.certifications.map((cert: any) => `<li>${escapeHtml(typeof cert === 'string' ? cert : cert.title ?? cert.name)}</li>`).join('')}</ul>` : ''}
</body>
</html>`;
}

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
    const buffer = await this.renderPdfBuffer(resume.content_json);
    const storagePath = `${userId}/resume-${resume.version}.pdf`;
    const bucket = env.RESUME_STORAGE_BUCKET;

    const { data: storageData, error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (uploadError) throw new AppError(uploadError.message, 500, 'PDF_UPLOAD_FAILED');

    const { data: publicUrl } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
    await supabaseAdmin.from('resumes').update({ pdf_url: publicUrl.publicUrl }).eq('id', resume.id);

    return {
      ...storageData,
      pdf_url: publicUrl.publicUrl,
    };
  }

  private static async renderPdfBuffer(contentJson: any): Promise<Buffer> {
    try {
      const puppeteerModule = await importDynamic('puppeteer');
      const puppeteer = puppeteerModule.default ?? puppeteerModule;
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(buildResumeHTML(contentJson), { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        });
        return Buffer.from(pdf);
      } finally {
        await browser.close();
      }
    } catch (error) {
      logger.warn({
        message: 'Puppeteer resume render failed; falling back to PDFKit',
        error: error instanceof Error ? error.message : String(error),
      });
      return this.renderPdfKitBuffer(contentJson);
    }
  }

  private static async renderPdfKitBuffer(contentJson: any): Promise<Buffer> {
    const content = normalizeContent(contentJson);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 32 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(22).text(content.basics.name);
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#64748b').text([
        content.basics.email,
        content.basics.phone,
        content.basics.location,
        content.basics.linkedin,
        content.basics.github,
      ].filter(Boolean).join(' | '));
      doc.fillColor('#111827').moveDown();

      if (content.basics.summary) {
        doc.fontSize(14).text('Summary');
        doc.fontSize(11).text(content.basics.summary);
        doc.moveDown();
      }

      if (content.skills.length) {
        doc.fontSize(14).text('Skills');
        doc.fontSize(11).text(content.skills.map((skill: any) => typeof skill === 'string' ? skill : skill.skill_name ?? skill.name).join(', '));
        doc.moveDown();
      }

      if (content.projects.length) {
        doc.fontSize(14).text('Projects');
        for (const project of content.projects) {
          doc.fontSize(11).text(`${project.name ?? 'Project'}: ${itemPoints(project).join(' ')}`);
        }
        doc.moveDown();
      }

      if (content.experience.length) {
        doc.fontSize(14).text('Experience');
        for (const exp of content.experience) {
          doc.fontSize(11).text(`${exp.title ?? exp.role ?? 'Experience'} ${exp.company ? `- ${exp.company}` : ''}`);
          for (const point of itemPoints(exp)) {
            doc.fontSize(10).text(`- ${point}`);
          }
        }
      }

      doc.end();
    });
  }
}
