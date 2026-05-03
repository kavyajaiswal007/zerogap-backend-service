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
    extracurricular: Array.isArray(content?.extracurricular) ? content.extracurricular : [],
    languages: Array.isArray(content?.languages) ? content.languages : [],
  };
}

function itemPoints(item: any) {
  if (Array.isArray(item?.points)) return item.points;
  if (Array.isArray(item?.bullets)) return item.bullets;
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
    @page { size: A4; margin: 0.5in; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 9.5pt; color: #000; padding: 0; line-height: 1.25; }
    .name { font-size: 22pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }
    .contact-line { text-align: center; font-size: 9.5pt; color: #333; margin-top: 4px; }
    .section-title { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #000; margin-top: 8px; margin-bottom: 4px; padding-bottom: 1px; }
    .entry-header { display: flex; justify-content: space-between; gap: 12px; }
    .entry-title { font-weight: 700; font-size: 9.8pt; }
    .entry-subtitle { font-style: italic; color: #333; }
    .entry-date { font-size: 9.5pt; white-space: nowrap; }
    ul { margin-left: 16px; margin-top: 2px; }
    li { margin-bottom: 1px; font-size: 9.4pt; }
    .skills-row { display: flex; gap: 8px; margin-bottom: 2px; }
    .skills-label { font-weight: 700; min-width: 100px; font-size: 10pt; }
    .skills-value { font-size: 9.5pt; }
  </style>
</head>
<body>
  <div class="name">${escapeHtml(content.basics.name)}</div>
  <div class="contact-line">${contact}</div>
  ${content.summary ? `<div class="section-title">Summary</div><p style="font-size:9.5pt">${escapeHtml(content.summary)}</p>` : ''}
  ${content.skillLines.length ? `<div class="section-title">Technical Skills</div>
    <div class="skills-row"><span class="skills-label">Technical:</span><span class="skills-value">${escapeHtml(technicalLines.join(', '))}</span></div>
    <div class="skills-row"><span class="skills-label">Tools:</span><span class="skills-value">${escapeHtml((skills.tools.length ? skills.tools : content.skillLines.slice(10)).join(', '))}</span></div>
    <div class="skills-row"><span class="skills-label">Strengths:</span><span class="skills-value">${escapeHtml(skills.soft.join(', '))}</span></div>` : ''}
  ${content.experience.length ? `<div class="section-title">Experience</div>${content.experience.map((exp: any) => `
    <div class="entry-header">
      <div><span class="entry-title">${escapeHtml(exp.title ?? exp.role ?? 'Experience')}</span>${exp.company ? ` — <span class="entry-subtitle">${escapeHtml(exp.company)}${exp.location ? `, ${escapeHtml(exp.location)}` : ''}</span>` : ''}</div>
      <div class="entry-date">${escapeHtml(exp.duration ?? exp.period ?? [exp.startDate ?? exp.start_date, exp.endDate ?? exp.end_date].filter(Boolean).join(' - '))}</div>
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
      ${project.description ? `<p style="font-size:9.4pt">${escapeHtml(project.description)}</p>` : ''}
      <ul>${itemPoints(project).map((point: string) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
  `).join('')}` : ''}
  ${content.certifications.length ? `<div class="section-title">Certifications</div>${content.certifications.map((cert: any) => `<div style="display:flex;justify-content:space-between;font-size:10pt"><span><strong>${escapeHtml(typeof cert === 'string' ? cert : cert.title ?? cert.name)}</strong>${cert.issuer ? ` — ${escapeHtml(cert.issuer)}` : ''}</span><span>${escapeHtml(cert.date ?? cert.issue_date ?? '')}</span></div>`).join('')}` : ''}
  ${content.achievements.length ? `<div class="section-title">Achievements</div><ul>${content.achievements.map((achievement: string) => `<li>${escapeHtml(achievement)}</li>`).join('')}</ul>` : ''}
  ${content.extracurricular.length ? `<div class="section-title">Extra-curricular</div><ul>${content.extracurricular.map((activity: string) => `<li>${escapeHtml(activity)}</li>`).join('')}</ul>` : ''}
  ${content.languages.length ? `<div class="section-title">Languages</div><p style="font-size:9.5pt">${escapeHtml(content.languages.join(', '))}</p>` : ''}
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
    const certificateLabels = (certificates.data ?? [])
      .map((cert: any) => `${cert.title ?? cert.name ?? 'Certification'} by ${cert.issuer ?? 'Issuer'}`)
      .join(', ');

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
      summary: `${profile.full_name ?? 'ZeroGap Candidate'} is a ${targetJobTitle} candidate with hands-on project execution, verified technical growth, and recruiter-ready proof of work. They have built practical systems across frontend, backend, databases, deployment, and portfolio storytelling. Their current focus is shipping measurable product features, improving interview readiness, and converting project proof into strong job applications. They bring ownership, fast learning, written communication, and consistent execution discipline to junior engineering teams.`,
      skills: {
        technical: [
          ...skills.map((skill) => skill.skill_name),
          'REST APIs',
          'System Design',
          'Testing Strategy',
          'Responsive UI',
          'Database Modeling',
        ].filter(Boolean).slice(0, 24),
        soft: ['Ownership', 'Written Communication', 'Product Thinking', 'Debugging', 'Stakeholder Updates'],
        tools: ['Git', 'GitHub', 'Supabase', 'Vercel', 'PostgreSQL', 'Redis', 'Postman', 'Docker', 'Chrome DevTools', 'GitHub Actions'],
      },
      experience: [
        {
          title: `${targetJobTitle} Intern`,
          company: 'ZeroGap Labs',
          location: profile.location ?? 'India',
          startDate: 'Jan 2026',
          endDate: 'Present',
          points: [
            `Shipped career-readiness features using ${skills.slice(0, 5).map((skill) => skill.skill_name).join(', ') || 'modern web technologies'} and reusable product workflows.`,
            'Built authenticated product flows for profile, skill gap, job matching, mentor guidance, and resume generation using structured response contracts.',
            'Improved dashboard reliability by adding cached local state, friendly fallbacks, loading skeletons, and zero-blank-screen handling across core pages.',
            'Converted recruiter feedback into cleaner hierarchy, sharper CTA copy, stronger proof-first resume sections, and more measurable project descriptions.',
            'Documented user workflows, edge cases, API contracts, and demo-ready data to reduce broken journeys during product reviews.',
            'Practiced weekly shipping discipline by completing roadmap tasks, recording walkthroughs, and attaching proof links to career assets.',
          ],
        },
      ],
      projects: (proofs.data ?? []).slice(0, 3).map((proof) => ({
        name: proof.repo_name,
        tech_stack: Array.isArray(proof.skills_detected) ? proof.skills_detected.join(', ') : targetJobTitle,
        github_url: proof.repo_url,
        live_url: '',
        bullets: [
          `Built ${proof.repo_name} demonstrating ${Array.isArray(proof.skills_detected) ? proof.skills_detected.join(', ') : 'technical depth'}.`,
          `Implemented maintainable features and documented proof for recruiter review.`,
          'Added screenshots, architecture notes, measurable learning outcomes, and clean README sections for hiring-manager review.',
        ],
      })),
      certifications: certificates.data ?? [],
      extracurricular: [
        'Led peer review sessions for resumes, portfolios, and project walkthroughs.',
        'Practiced mock interviews with structured feedback loops and role-specific question banks.',
        'Shared weekly learning notes covering debugging decisions, tradeoffs, and deployment mistakes.',
      ],
      languages: ['English (Fluent)', 'Hindi (Native)'],
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
        'Maintained consistent proof-of-work updates across GitHub, resume, and job applications.',
        'Prepared role-specific applications by mapping target job keywords to live project evidence.',
        'Created recruiter-readable case studies explaining problem, approach, impact, and next iteration.',
      ],
    };

    const system = `You are an expert ATS resume writer and career coach.
Generate a COMPLETE, DETAILED, 3-PAGE resume for this candidate.
The resume must be packed with relevant content — do NOT make it sparse.
Use strong action verbs. Quantify achievements wherever possible.
Make the professional summary 4-5 sentences. Each experience should have 5-7 bullet points.
Include all sections: Summary, Technical Skills, Experience, Projects (minimum 3), Education, Certifications, Achievements, Extra-curricular, Publications if applicable.
Return ONLY valid JSON — no markdown.`;

    const prompt = `Generate a complete 3-page ATS-optimized resume for:

Name: ${profile.full_name}
Target Role: ${targetJobTitle}
College: ${profile.college_name}
Degree: ${profile.degree}
Graduation: ${profile.graduation_year}
LinkedIn: ${profile.linkedin_url || ''}
GitHub: ${profile.github_username ? 'github.com/' + profile.github_username : ''}
Location: ${profile.location || 'India'}
Skills: ${skills.map((skill) => skill.skill_name + ' (' + skill.proficiency_level + '%)').join(', ')}
Certifications: ${certificateLabels}

Return this JSON:
{
  "basics": {
    "name": "full name",
    "email": "email",
    "phone": "+91-XXXXXXXXXX",
    "location": "city, state",
    "linkedin": "linkedin url",
    "github": "github url",
    "portfolio": ""
  },
  "summary": "4-5 sentence professional summary packed with keywords for ${targetJobTitle}",
  "skills": {
    "technical": ["20+ technical skills relevant to ${targetJobTitle}"],
    "tools": ["10+ tools and platforms"],
    "soft": ["5 soft skills"]
  },
  "experience": [
    {
      "title": "role",
      "company": "company",
      "location": "city",
      "startDate": "Jan 2024",
      "endDate": "Present",
      "description": "",
      "points": [
        "Strong action verb + specific achievement + quantified result",
        "5-7 bullet points per role"
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "tech": ["React", "Node.js"],
      "description": "2-3 sentence description",
      "points": ["Achievement 1", "Achievement 2", "Achievement 3"],
      "url": "github.com/..."
    }
  ],
  "education": [],
  "certifications": [],
  "achievements": ["5-7 academic/professional achievements"],
  "extracurricular": ["3-5 activities"],
  "languages": ["English (Fluent)", "Hindi (Native)"]
}`;

    const resumeJson = await getClaudeJson<any>(
      system,
      `${prompt}

User data for grounding:
${JSON.stringify({
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
      const doc = new PDFDocument({ margin: 36 });
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
        doc.fontSize(9.5).text(content.summary);
        doc.moveDown();
      }

      if (content.skillLines.length) {
        doc.fontSize(14).text('Skills');
        if (content.skills.technical.length) doc.fontSize(9.5).text(`Technical: ${content.skills.technical.join(', ')}`);
        if (content.skills.tools.length) doc.fontSize(9.5).text(`Tools: ${content.skills.tools.join(', ')}`);
        if (content.skills.soft.length) doc.fontSize(9.5).text(`Strengths: ${content.skills.soft.join(', ')}`);
        doc.moveDown();
      }

      if (content.experience.length) {
        doc.fontSize(14).text('Experience');
        for (const exp of content.experience) {
          doc.fontSize(10).text(`${exp.title ?? exp.role ?? 'Experience'} ${exp.company ? `- ${exp.company}` : ''}`);
          for (const point of itemPoints(exp)) {
            doc.fontSize(9.5).text(`- ${point}`);
          }
        }
        doc.moveDown();
      }

      if (content.projects.length) {
        doc.fontSize(14).text('Projects');
        for (const project of content.projects) {
          doc.fontSize(10).text(`${project.name ?? 'Project'} ${project.tech_stack || project.tech ? `| ${Array.isArray(project.tech) ? project.tech.join(', ') : project.tech_stack}` : ''}`);
          if (project.description) doc.fontSize(9.5).text(project.description);
          for (const point of itemPoints(project)) {
            doc.fontSize(9.5).text(`- ${point}`);
          }
        }
        doc.moveDown();
      }

      if (content.education.length) {
        doc.fontSize(14).text('Education');
        for (const edu of content.education) {
          doc.fontSize(9.5).text(`${edu.degree ?? 'Degree'} - ${edu.institution ?? 'Institution'} ${edu.graduation || edu.year ? `(${edu.graduation ?? edu.year})` : ''}`);
        }
        doc.moveDown();
      }

      if (content.certifications.length) {
        doc.fontSize(14).text('Certifications');
        for (const cert of content.certifications) {
          doc.fontSize(9.5).text(`- ${typeof cert === 'string' ? cert : `${cert.title ?? cert.name}${cert.issuer ? ` by ${cert.issuer}` : ''}`}`);
        }
        doc.moveDown();
      }

      if (content.achievements.length) {
        doc.fontSize(14).text('Achievements');
        for (const achievement of content.achievements) {
          doc.fontSize(9.5).text(`- ${achievement}`);
        }
        doc.moveDown();
      }

      if (content.extracurricular.length) {
        doc.fontSize(14).text('Extra-curricular');
        for (const activity of content.extracurricular) {
          doc.fontSize(9.5).text(`- ${activity}`);
        }
      }

      if (content.languages.length) {
        doc.moveDown();
        doc.fontSize(14).text('Languages');
        doc.fontSize(9.5).text(content.languages.join(', '));
      }

      doc.end();
    });
  }
}
