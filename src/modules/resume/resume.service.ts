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
  const legacySkills = Array.isArray(content?.skills) ? content.skills : [];
  const technicalSkills = Array.isArray(content?.skills?.technical)
    ? content.skills.technical
    : legacySkills.map((skill: any) => typeof skill === 'string' ? skill : skill.skill_name ?? skill.name).filter(Boolean);
  const skillLines = [
    ...(technicalSkills.length ? technicalSkills : []),
    ...(Array.isArray(content?.skills?.tools) ? content.skills.tools : []),
    ...(Array.isArray(content?.skills?.soft) ? content.skills.soft : []),
  ].map((skill: any) => String(skill)).filter(Boolean);

  return {
    basics: {
      name: content?.basics?.name ?? content?.name ?? 'ZeroGap Candidate',
      email: content?.basics?.email ?? content?.email ?? '',
      phone: content?.basics?.phone ?? content?.phone ?? '',
      location: content?.basics?.location ?? content?.location ?? '',
      linkedin: content?.basics?.linkedin ?? content?.linkedin ?? '',
      github: content?.basics?.github ?? content?.github ?? '',
      portfolio: content?.basics?.portfolio ?? content?.portfolio ?? '',
    },
    summary: content?.summary ?? content?.basics?.summary ?? '',
    skills: {
      technical: technicalSkills,
      soft: Array.isArray(content?.skills?.soft) ? content.skills.soft : [],
      tools: Array.isArray(content?.skills?.tools) ? content.skills.tools : [],
    },
    skillLines,
    projects: Array.isArray(content?.projects) ? content.projects : [],
    experience: Array.isArray(content?.experience) ? content.experience : [],
    education: Array.isArray(content?.education) ? content.education : [],
    achievements: Array.isArray(content?.achievements) ? content.achievements : [],
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
    content.basics.location,
    content.basics.email,
    content.basics.phone,
    content.basics.linkedin,
    content.basics.github,
    content.basics.portfolio,
  ].filter(Boolean).map(escapeHtml).join(' | ');
  const skills = content.skills;
  const technicalLines = skills.technical.length ? skills.technical : content.skillLines;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; color: #000; padding: 0.5in 0.6in; line-height: 1.3; }
    .name { font-size: 22pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }
    .contact-line { text-align: center; font-size: 9.5pt; color: #333; margin-top: 4px; }
    .section-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #000; margin-top: 10px; margin-bottom: 4px; padding-bottom: 1px; }
    .entry-header { display: flex; justify-content: space-between; gap: 12px; }
    .entry-title { font-weight: 700; font-size: 10.5pt; }
    .entry-subtitle { font-style: italic; color: #333; }
    .entry-date { font-size: 9.5pt; white-space: nowrap; }
    ul { margin-left: 16px; margin-top: 2px; }
    li { margin-bottom: 1.5px; font-size: 10pt; }
    .skills-row { display: flex; gap: 8px; margin-bottom: 2px; }
    .skills-label { font-weight: 700; min-width: 100px; font-size: 10pt; }
    .skills-value { font-size: 10pt; }
  </style>
</head>
<body>
  <div class="name">${escapeHtml(content.basics.name)}</div>
  <div class="contact-line">${contact}</div>
  ${content.summary ? `<div class="section-title">Summary</div><p style="font-size:10pt">${escapeHtml(content.summary)}</p>` : ''}
  ${content.skillLines.length ? `<div class="section-title">Technical Skills</div>
    <div class="skills-row"><span class="skills-label">Languages:</span><span class="skills-value">${escapeHtml(technicalLines[0] ?? content.skillLines.slice(0, 5).join(', '))}</span></div>
    <div class="skills-row"><span class="skills-label">Frameworks:</span><span class="skills-value">${escapeHtml(technicalLines[1] ?? content.skillLines.slice(5, 10).join(', '))}</span></div>
    <div class="skills-row"><span class="skills-label">Tools & Cloud:</span><span class="skills-value">${escapeHtml((skills.tools.length ? skills.tools : content.skillLines.slice(10)).join(', '))}</span></div>` : ''}
  ${content.experience.length ? `<div class="section-title">Experience</div>${content.experience.map((exp: any) => `
    <div class="entry-header">
      <div><span class="entry-title">${escapeHtml(exp.title ?? exp.role ?? 'Experience')}</span>${exp.company ? ` — <span class="entry-subtitle">${escapeHtml(exp.company)}${exp.location ? `, ${escapeHtml(exp.location)}` : ''}</span>` : ''}</div>
      <div class="entry-date">${escapeHtml(exp.duration ?? exp.period ?? [exp.start_date, exp.end_date].filter(Boolean).join(' - '))}</div>
    </div>
      <ul>${itemPoints(exp).map((point: string) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
  `).join('')}` : ''}
  ${content.education.length ? `<div class="section-title">Education</div>${content.education.map((edu: any) => `
    <div class="entry-header">
      <div><span class="entry-title">${escapeHtml(edu.degree ?? 'Degree')}</span>${edu.institution ? ` — <span class="entry-subtitle">${escapeHtml(edu.institution)}</span>` : ''}</div>
      <div class="entry-date">${escapeHtml(edu.graduation ?? edu.year ?? '')}</div>
    </div>
    ${edu.cgpa ? `<p style="font-size:9.5pt;color:#333">CGPA: ${escapeHtml(edu.cgpa)}${Array.isArray(edu.relevant_courses) ? ` | Relevant: ${edu.relevant_courses.map(escapeHtml).join(', ')}` : ''}</p>` : ''}
  `).join('')}` : ''}
  ${content.projects.length ? `<div class="section-title">Projects</div>${content.projects.map((project: any) => `
    <div class="entry-header">
      <div><span class="entry-title">${escapeHtml(project.name ?? 'Project')}</span> <span style="font-size:9.5pt">| ${escapeHtml(project.tech_stack ?? (Array.isArray(project.tech) ? project.tech.join(', ') : ''))}</span></div>
    </div>
      <ul>${itemPoints(project).map((point: string) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
  `).join('')}` : ''}
  ${content.certifications.length ? `<div class="section-title">Certifications</div>${content.certifications.map((cert: any) => `<div style="display:flex;justify-content:space-between;font-size:10pt"><span><strong>${escapeHtml(typeof cert === 'string' ? cert : cert.title ?? cert.name)}</strong>${cert.issuer ? ` — ${escapeHtml(cert.issuer)}` : ''}</span><span>${escapeHtml(cert.date ?? cert.issue_date ?? '')}</span></div>`).join('')}` : ''}
  ${content.achievements.length ? `<div class="section-title">Achievements</div><ul>${content.achievements.map((achievement: string) => `<li>${escapeHtml(achievement)}</li>`).join('')}</ul>` : ''}
</body>
</html>`;
}

function calculateAtsScore(resumeContent: any, jobKeywords: string[]) {
  const resumeText = JSON.stringify(resumeContent).toLowerCase();
  const keywords = jobKeywords.length ? jobKeywords : ['react', 'javascript', 'typescript', 'api', 'git', 'sql'];
  const keywordHits = keywords.filter((keyword) => resumeText.includes(String(keyword).toLowerCase()));
  const keywordScore = (keywordHits.length / keywords.length) * 40;
  const hasQuantifiedAchievements = /\d+%|\d+x|\$[\d,]+|\d+\+/.test(resumeText) ? 20 : 0;
  const hasActionVerbs = ['developed', 'built', 'designed', 'led', 'implemented', 'optimized']
    .filter((verb) => resumeText.includes(verb)).length * 3;
  const hasSections = ['summary', 'experience', 'education', 'projects', 'skills']
    .filter((section) => resumeText.includes(section)).length * 4;
  const lengthScore = resumeText.length > 900 && resumeText.length < 9000 ? 2 : 0;

  return Math.min(100, Math.round(keywordScore + hasQuantifiedAchievements + Math.min(18, hasActionVerbs) + hasSections + lengthScore));
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
        phone: '',
        location: profile.location,
        linkedin: profile.linkedin_url ?? '',
        github: profile.github_username ? `https://github.com/${profile.github_username}` : '',
        portfolio: '',
      },
      summary: `${profile.full_name ?? 'ZeroGap Candidate'} is building toward a ${targetJobTitle} role with hands-on projects, measurable skill growth, and production-ready proof of work.`,
      skills: {
        technical: [
          skills.slice(0, 6).map((skill) => skill.skill_name).join(', '),
          skills.slice(6, 12).map((skill) => skill.skill_name).join(', '),
        ].filter(Boolean),
        soft: ['Communication', 'Problem Solving', 'Ownership'],
        tools: ['Git', 'GitHub', 'Supabase', 'Vercel'],
      },
      projects: (proofs.data ?? []).slice(0, 3).map((proof) => ({
        name: proof.repo_name,
        tech_stack: Array.isArray(proof.skills_detected) ? proof.skills_detected.join(', ') : targetJobTitle,
        github_url: proof.repo_url,
        live_url: '',
        bullets: [
          `Built ${proof.repo_name} demonstrating ${Array.isArray(proof.skills_detected) ? proof.skills_detected.join(', ') : 'technical depth'}.`,
          `Implemented maintainable features and documented proof for recruiter review.`,
        ],
      })),
      certifications: certificates.data ?? [],
      experience: [],
      education: [{
        degree: profile.degree ?? 'B.Tech Computer Science',
        institution: profile.college_name ?? 'Independent learner',
        location: profile.location ?? 'India',
        graduation: profile.graduation_year ? String(profile.graduation_year) : 'Present',
        cgpa: '',
        relevant_courses: ['Data Structures', 'Web Development', 'Database Systems'],
      }],
      achievements: [
        'Built portfolio-ready project proof with measurable skill growth.',
        'Completed focused roadmap tasks toward target role readiness.',
      ],
    };

    const resumeJson = await getClaudeJson<any>(
      `You are a professional ATS resume writer specializing in Indian tech job market.
Generate a complete resume for the candidate below.
Return ONLY valid JSON matching this EXACT schema — no markdown, no explanation:
{
  "basics": { "name": string, "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "portfolio": string },
  "summary": string,
  "skills": { "technical": string[], "soft": string[], "tools": string[] },
  "experience": [{ "title": string, "company": string, "location": string, "start_date": "MMM YYYY", "end_date": "MMM YYYY or Present", "bullets": string[] }],
  "education": [{ "degree": string, "institution": string, "location": string, "graduation": string, "cgpa": string, "relevant_courses": string[] }],
  "projects": [{ "name": string, "tech_stack": string, "github_url": string, "live_url": string, "bullets": string[] }],
  "certifications": [{ "name": string, "issuer": string, "date": string, "url": string }],
  "achievements": string[]
}`,
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
    const atsScore = calculateAtsScore(resumeJson, keywords);

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
          printBackground: false,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
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

      if (content.summary) {
        doc.fontSize(14).text('Summary');
        doc.fontSize(11).text(content.summary);
        doc.moveDown();
      }

      if (content.skillLines.length) {
        doc.fontSize(14).text('Skills');
        doc.fontSize(11).text(content.skillLines.join(', '));
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
