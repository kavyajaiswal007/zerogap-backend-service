import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are required');
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ACCOUNTS = [
  {
    name: 'Maya Sharma',
    email: 'maya@zerogap.com',
    password: 'demo1234',
    targetRole: 'Full Stack Developer',
    specialization: 'MERN + AI dashboards',
    college: 'NIET Greater Noida',
    degree: 'B.Tech Computer Science',
    graduationYear: 2026,
    location: 'Noida, India',
    learningStyle: 'project-based',
    hours: 4,
    github: 'maya-zero-demo',
    linkedin: 'https://linkedin.com/in/maya-zero-demo',
    portfolio: 'https://maya-zero-demo.vercel.app',
    score: { final: 84, skills: 86, project: 82, activity: 84 },
    xp: { total: 6120, level: 13, streak: 31, longest: 34 },
    skills: [
      ['React', 92, true, 'github'],
      ['TypeScript', 86, true, 'github'],
      ['Node.js', 84, true, 'project'],
      ['Express', 82, true, 'project'],
      ['PostgreSQL', 78, true, 'project'],
      ['REST API', 88, true, 'project'],
      ['Tailwind CSS', 90, true, 'project'],
      ['Docker', 66, false, 'self_declared'],
      ['System Design Basics', 62, false, 'self_declared'],
      ['Redis', 58, false, 'self_declared'],
    ],
    matched: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'REST API', 'Tailwind CSS', 'Git'],
    partial: ['Docker', 'System Design Basics', 'Redis'],
    missing: ['Kubernetes', 'GraphQL'],
    projects: [
      {
        title: 'Campus Placement CRM',
        description: 'A multi-role placement dashboard with recruiter pipeline, student readiness scoring, and analytics.',
        stack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis'],
        difficulty: 'advanced',
      },
      {
        title: 'AI Resume Optimizer',
        description: 'ATS resume generator with keyword gap detection, PDF export, and interview preparation prompts.',
        stack: ['React', 'Express', 'OpenAI', 'Supabase'],
        difficulty: 'intermediate',
      },
      {
        title: 'Real-Time Learning Tracker',
        description: 'Execution logging system with streak analytics, task proof capture, and weekly consistency charts.',
        stack: ['React', 'TypeScript', 'Express', 'Supabase', 'Charting'],
        difficulty: 'intermediate',
      },
    ],
    resumeTitle: 'Full Stack Developer',
    risk: { level: 'low', months: 2, probability: 86 },
    benchmark: { college: 94, national: 88, avgCollege: 58, avgNational: 61 },
  },
  {
    name: 'Aarav Mehta',
    email: 'aarav@zerogap.com',
    password: 'demo1234',
    targetRole: 'Data Scientist',
    specialization: 'ML analytics + product intelligence',
    college: 'NIET Greater Noida',
    degree: 'B.Tech Artificial Intelligence',
    graduationYear: 2026,
    location: 'Bengaluru, India',
    learningStyle: 'guided practice',
    hours: 5,
    github: 'aarav-data-demo',
    linkedin: 'https://linkedin.com/in/aarav-data-demo',
    portfolio: 'https://aarav-data-lab.vercel.app',
    score: { final: 81, skills: 84, project: 78, activity: 79 },
    xp: { total: 5480, level: 11, streak: 30, longest: 31 },
    skills: [
      ['Python', 94, true, 'github'],
      ['SQL', 88, true, 'project'],
      ['Pandas/NumPy', 86, true, 'project'],
      ['Machine Learning', 82, true, 'project'],
      ['Statistics', 78, true, 'certificate'],
      ['Data Visualization', 84, true, 'project'],
      ['Scikit-learn', 80, true, 'github'],
      ['TensorFlow/PyTorch', 64, false, 'self_declared'],
      ['Feature Engineering', 76, true, 'project'],
      ['MLOps', 52, false, 'self_declared'],
    ],
    matched: ['Python', 'SQL', 'Pandas/NumPy', 'Machine Learning', 'Statistics', 'Data Visualization', 'Feature Engineering'],
    partial: ['TensorFlow/PyTorch', 'MLOps'],
    missing: ['Airflow', 'Model Deployment'],
    projects: [
      {
        title: 'Placement Success Predictor',
        description: 'Predicts placement readiness using student skill evidence, tracker logs, and portfolio strength.',
        stack: ['Python', 'Pandas', 'Scikit-learn', 'FastAPI', 'PostgreSQL'],
        difficulty: 'advanced',
      },
      {
        title: 'Job Market Trend Dashboard',
        description: 'Analyzes job descriptions to detect trending skills, salaries, and role demand across India.',
        stack: ['Python', 'SQL', 'Plotly', 'Streamlit'],
        difficulty: 'intermediate',
      },
      {
        title: 'Resume Skill Extractor',
        description: 'Parses resumes, extracts technical evidence, and compares candidate profile to market requirements.',
        stack: ['Python', 'FastAPI', 'NLP', 'PostgreSQL'],
        difficulty: 'intermediate',
      },
    ],
    resumeTitle: 'Data Scientist',
    risk: { level: 'low', months: 3, probability: 82 },
    benchmark: { college: 91, national: 85, avgCollege: 57, avgNational: 63 },
  },
  {
    name: 'Kavya Demo Account',
    email: 'kavya@zerogap.com',
    password: 'demo1234',
    targetRole: 'Full Stack Developer',
    specialization: 'Startup product engineering',
    college: 'NIET Greater Noida',
    degree: 'B.Tech Information Technology',
    graduationYear: 2026,
    location: 'Greater Noida, India',
    learningStyle: 'mentor-led',
    hours: 3,
    github: 'kavya-zerogap-demo',
    linkedin: 'https://linkedin.com/in/kavya-zerogap-demo',
    portfolio: 'https://zerogap-frontend-002.vercel.app',
    score: { final: 76, skills: 78, project: 72, activity: 80 },
    xp: { total: 4960, level: 10, streak: 30, longest: 30 },
    skills: [
      ['React', 84, true, 'project'],
      ['JavaScript', 86, true, 'project'],
      ['TypeScript', 72, true, 'project'],
      ['Node.js', 76, true, 'project'],
      ['Supabase', 82, true, 'project'],
      ['REST API', 80, true, 'project'],
      ['Tailwind CSS', 88, true, 'project'],
      ['PostgreSQL', 68, false, 'self_declared'],
      ['Docker', 48, false, 'self_declared'],
      ['Testing (Jest/RTL)', 52, false, 'self_declared'],
    ],
    matched: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Supabase', 'REST API', 'Tailwind CSS'],
    partial: ['PostgreSQL', 'Testing (Jest/RTL)'],
    missing: ['Docker', 'System Design Basics', 'Redis'],
    projects: [
      {
        title: 'ZeroGap Employability Platform',
        description: 'Full-stack skill mapping platform with jobs, roadmap, AI mentor, tracker, resume, and benchmarks.',
        stack: ['React', 'TypeScript', 'Express', 'Supabase', 'Redis'],
        difficulty: 'advanced',
      },
      {
        title: 'Student Proof Portfolio',
        description: 'Portfolio generator that converts roadmap tasks, certificates, and GitHub repos into hiring proof.',
        stack: ['React', 'Supabase', 'PDF', 'OpenAI'],
        difficulty: 'intermediate',
      },
      {
        title: 'AI Mentor Chat',
        description: 'Streaming mentor assistant that answers using score, roadmap, resume, jobs, and tracker context.',
        stack: ['React', 'Express', 'OpenAI', 'SSE', 'Supabase'],
        difficulty: 'advanced',
      },
    ],
    resumeTitle: 'Full Stack Developer',
    risk: { level: 'medium', months: 4, probability: 74 },
    benchmark: { college: 86, national: 78, avgCollege: 58, avgNational: 61 },
  },
];

const ACHIEVEMENTS = [
  { name: 'First Step', description: 'Complete your first task', badge_icon: 'check-circle', xp_reward: 100, condition_type: 'task_count', condition_value: { min: 1 } },
  { name: 'Skill Seeker', description: 'Add 5 verified skills', badge_icon: 'target', xp_reward: 150, condition_type: 'verified_skills', condition_value: { min: 5 } },
  { name: 'Proof Master', description: 'Analyze 5 GitHub repos', badge_icon: 'shield-check', xp_reward: 200, condition_type: 'proof_count', condition_value: { min: 5 } },
  { name: 'Consistent', description: 'Maintain a 7-day streak', badge_icon: 'flame', xp_reward: 250, condition_type: 'streak_days', condition_value: { min: 7 } },
  { name: 'On Fire', description: 'Maintain a 30-day streak', badge_icon: 'flame', xp_reward: 400, condition_type: 'streak_days', condition_value: { min: 30 } },
  { name: 'Rising Star', description: 'Reach skill score 50', badge_icon: 'star', xp_reward: 250, condition_type: 'skill_score', condition_value: { min: 50 } },
  { name: 'Job Ready', description: 'Reach skill score 80', badge_icon: 'rocket', xp_reward: 500, condition_type: 'skill_score', condition_value: { min: 80 } },
  { name: 'Roadmap Warrior', description: 'Complete all roadmap stages', badge_icon: 'map', xp_reward: 300, condition_type: 'roadmap_completion', condition_value: { min: 100 } },
  { name: 'Interview Ready', description: 'Generate ATS resume and reach score 75', badge_icon: 'file-text', xp_reward: 350, condition_type: 'resume_and_score', condition_value: { min: 75 } },
  { name: 'First Task Complete', description: 'Completed the first roadmap task', badge_icon: 'check-circle', xp_reward: 100, condition_type: 'tasks_completed', condition_value: { count: 1 } },
  { name: '7 Day Streak', description: 'Stayed active for a full week', badge_icon: 'flame', xp_reward: 250, condition_type: 'streak_days', condition_value: { count: 7 } },
  { name: 'Portfolio Builder', description: 'Built a portfolio-quality project', badge_icon: 'briefcase', xp_reward: 300, condition_type: 'projects_completed', condition_value: { count: 1 } },
  { name: 'Job Ready 75+', description: 'Crossed a 75 readiness score', badge_icon: 'rocket', xp_reward: 500, condition_type: 'score_above', condition_value: { score: 75 } },
  { name: 'Resume Shipped', description: 'Generated an ATS resume', badge_icon: 'file-text', xp_reward: 150, condition_type: 'resume_generated', condition_value: { count: 1 } },
  { name: 'Proof Collector', description: 'Added verified GitHub or certificate proof', badge_icon: 'shield-check', xp_reward: 200, condition_type: 'proofs_added', condition_value: { count: 2 } },
];

const JOBS = [
  {
    external_id: 'demo-fullstack-1',
    title: 'Full Stack Developer - React + Node.js',
    company: 'Razorpay',
    location: 'Bengaluru, India',
    salary_range: 'Est. ₹10-24 LPA',
    salary_lpa_min: 10,
    salary_lpa_max: 24,
    skills_required: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'REST API', 'Git'],
    description: 'Build merchant-facing dashboards, APIs, and reliable product workflows for a high-scale fintech platform.',
    apply_url: 'https://razorpay.com/jobs/',
    source: 'demo',
  },
  {
    external_id: 'demo-fullstack-2',
    title: 'Software Engineer - Frontend Platform',
    company: 'Zerodha',
    location: 'Remote, India',
    salary_range: 'Est. ₹12-28 LPA',
    salary_lpa_min: 12,
    salary_lpa_max: 28,
    skills_required: ['React', 'JavaScript', 'TypeScript', 'Testing (Jest/RTL)', 'CSS', 'Git'],
    description: 'Improve frontend infrastructure, component systems, performance, and customer-facing trading experiences.',
    apply_url: 'https://zerodha.com/careers/',
    source: 'demo',
  },
  {
    external_id: 'demo-data-1',
    title: 'Data Scientist - Product Analytics',
    company: 'Meesho',
    location: 'Bengaluru, India',
    salary_range: 'Est. ₹11-26 LPA',
    salary_lpa_min: 11,
    salary_lpa_max: 26,
    skills_required: ['Python', 'SQL', 'Pandas/NumPy', 'Machine Learning', 'Statistics', 'Data Visualization'],
    description: 'Create models, experiments, and dashboards to improve marketplace growth, conversion, and recommendation quality.',
    apply_url: 'https://www.meesho.io/jobs',
    source: 'demo',
  },
  {
    external_id: 'demo-data-2',
    title: 'ML Engineer - Forecasting',
    company: 'Swiggy',
    location: 'Hyderabad, India',
    salary_range: 'Est. ₹13-30 LPA',
    salary_lpa_min: 13,
    salary_lpa_max: 30,
    skills_required: ['Python', 'Machine Learning', 'Scikit-learn', 'Feature Engineering', 'Model Deployment', 'SQL'],
    description: 'Build demand forecasting and logistics intelligence models that power restaurant and delivery operations.',
    apply_url: 'https://careers.swiggy.com/',
    source: 'demo',
  },
];

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function dateOnly(days) {
  return daysAgo(days).slice(0, 10);
}

function asRows(account, userId) {
  return account.skills.map(([skill_name, proficiency_level, verified, proof_type]) => ({
    user_id: userId,
    skill_name,
    proficiency_level,
    verified,
    proof_type,
    proof_url: verified ? `https://github.com/${account.github}` : null,
    last_updated: daysAgo(Math.floor(Math.random() * 5)),
  }));
}

async function check(label, result, optional = false) {
  const value = await result;
  if (value?.error) {
    if (optional) {
      console.warn(`Optional skipped: ${label}: ${value.error.message}`);
      return value;
    }
    throw new Error(`${label}: ${value.error.message}`);
  }
  return value;
}

async function optional(label, operation) {
  try {
    return await check(label, operation, true);
  } catch (error) {
    console.warn(`Optional skipped: ${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function findAuthUser(email) {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function upsertAuthUser(account) {
  const existing = await findAuthUser(account.email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: {
        ...existing.user_metadata,
        full_name: account.name,
        role: 'student',
      },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      full_name: account.name,
      role: 'student',
    },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${account.email}`);
  return data.user;
}

async function resetUserRows(userId) {
  const deleteTables = [
    'notifications',
    'score_history',
    'user_job_matches',
    'execution_logs',
    'failure_predictions',
    'generated_projects',
    'resumes',
    'skill_gap_analyses',
    'peer_benchmarks',
    'user_achievements',
    'certificates',
    'github_proofs',
    'user_skills',
    'roadmap_tasks',
    'roadmaps',
    'target_roles',
    'chat_messages',
    'chat_sessions',
  ];

  for (const table of deleteTables) {
    await optional(`delete ${table}`, admin.from(table).delete().eq('user_id', userId));
  }
}

async function seedGlobalRows() {
  await check('upsert achievements', admin.from('achievements').upsert(ACHIEVEMENTS, { onConflict: 'name' }));

  const enrichedJobs = JOBS.map((job) => ({
    ...job,
    is_active: true,
    posted_at: daysAgo(2),
    fetched_at: new Date().toISOString(),
    job_type: job.title.toLowerCase().includes('intern') ? 'Internship' : 'Full-time',
    experience_required: job.title.toLowerCase().includes('senior') ? '3-5 years' : 'Fresher/0-2 years',
    is_remote: job.location.toLowerCase().includes('remote'),
    company_logo: null,
    qualifications: job.skills_required.join(', '),
    highlights: {
      Responsibilities: [
        `Build production features for ${job.company}`,
        'Collaborate with product, design, and engineering teams',
        'Ship measurable improvements with clean documentation',
      ],
      Qualifications: job.skills_required,
      Benefits: ['Mentorship', 'Hybrid flexibility', 'Fast growth team'],
    },
  }));

  const enriched = await admin.from('job_listings').upsert(enrichedJobs, { onConflict: 'external_id' });
  if (enriched.error) {
    await check('upsert base jobs', admin.from('job_listings').upsert(
      JOBS.map((job) => ({
        ...job,
        is_active: true,
        posted_at: daysAgo(2),
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: 'external_id' },
    ));
  }
}

function roadmapStages(account) {
  const isData = account.targetRole === 'Data Scientist';
  const missing = account.missing;

  return [
    {
      title: isData ? 'Data Foundations' : 'Product Foundations',
      description: isData ? 'Tighten SQL, stats, and Python data handling.' : 'Lock React, TypeScript, APIs, and UI polish.',
      skills_to_learn: isData ? ['SQL', 'Statistics', 'Pandas/NumPy'] : ['React', 'TypeScript', 'REST API'],
      completion: 100,
      tasks: [
        ['Revise core concepts with notes', 'learn', true, 70],
        ['Build a mini feature and document it', 'build', true, 90],
        ['Push proof to GitHub', 'practice', true, 80],
        ['Write a polished project README', 'practice', true, 60],
      ],
    },
    {
      title: isData ? 'Modeling Sprint' : 'Backend + Database Sprint',
      description: isData ? 'Train, evaluate, and explain models.' : 'Build reliable APIs, auth, and database workflows.',
      skills_to_learn: isData ? ['Machine Learning', 'Feature Engineering'] : ['Node.js', 'PostgreSQL', 'Redis'],
      completion: 100,
      tasks: [
        ['Complete implementation sprint', 'build', true, 100],
        ['Write edge-case checklist', 'practice', true, 70],
        [`Improve ${missing[0] ?? 'core skill'}`, 'learn', true, 60],
        ['Record a 90-second feature walkthrough', 'apply', true, 80],
      ],
    },
    {
      title: isData ? 'Deployment + Storytelling' : 'System Design + Testing',
      description: isData ? 'Package notebooks into an app and tell a data story.' : 'Add tests, monitoring, and architecture docs.',
      skills_to_learn: missing,
      completion: 65,
      tasks: [
        ['Create portfolio case study', 'build', true, 100],
        ['Prepare interview notes', 'practice', true, 60],
        ['Record a project demo', 'apply', false, 50],
        [`Ship one proof for ${missing[1] ?? missing[0] ?? 'advanced skill'}`, 'build', false, 80],
      ],
    },
    {
      title: 'Interview + Apply',
      description: 'Apply to roles with tailored proof and a tight resume.',
      skills_to_learn: ['Resume', 'Interview', 'Job Applications'],
      completion: 30,
      tasks: [
        ['Tailor ATS resume for 5 jobs', 'apply', true, 80],
        ['Complete one mock interview', 'practice', false, 70],
        ['Apply to top-fit roles', 'apply', false, 100],
        ['Follow up with recruiter-ready proof links', 'apply', false, 70],
      ],
    },
  ];
}

function resumeContent(account) {
  const skillNames = account.skills.map(([name]) => name);
  const isData = account.targetRole === 'Data Scientist';
  const firstName = account.name.split(' ')[0];
  const quantifiedImpact = isData
    ? 'improved model validation accuracy by 18% and reduced manual analysis time by 35%'
    : 'reduced dashboard load friction by 40% and improved demo task completion by 32%';

  return {
    basics: {
      name: account.name,
      email: account.email,
      phone: '+91 98765 43210',
      location: account.location,
      linkedin: account.linkedin,
      github: `https://github.com/${account.github}`,
      portfolio: account.portfolio,
    },
    summary: `${account.resumeTitle} candidate with verified proof across ${account.matched.slice(0, 6).join(', ')} and a ${account.xp.streak}-day execution streak. Built production-style projects with measurable outcomes, clean documentation, and recruiter-ready walkthroughs. Targeting high-growth Indian tech teams that value ownership, product thinking, and fast learning velocity.`,
    skills: {
      technical: [
        skillNames.slice(0, 4).join(', '),
        skillNames.slice(4, 8).join(', '),
        isData ? 'PostgreSQL, Jupyter, Streamlit, Feature Stores, Model Evaluation' : 'PostgreSQL, Supabase, Redis, REST APIs, Authentication',
        isData ? 'EDA, Feature Engineering, Regression, Classification, Experiment Tracking' : 'System Design Basics, API Integration, Responsive UI, Performance Optimization',
      ],
      soft: ['Communication', 'Ownership', 'Problem Solving', 'Documentation', 'Stakeholder Thinking'],
      tools: ['GitHub', 'Supabase', 'Vercel', 'Postman', 'VS Code', 'Notion', 'Figma'],
    },
    experience: [
      {
        title: `${account.resumeTitle} Trainee`,
        company: 'ZeroGap Labs',
        location: 'Remote',
        start_date: 'Jan 2026',
        end_date: 'Present',
        bullets: [
          `Built ${account.projects[0].title} with ${account.projects[0].stack.slice(0, 5).join(', ')} and ${quantifiedImpact}.`,
          `Converted ${account.xp.streak}+ days of roadmap execution into proof logs, GitHub notes, and ATS-ready resume bullets.`,
          `Integrated score, roadmap, resume, jobs, and mentor modules into a single demo workflow used for weekly review.`,
          `Wrote clean documentation, setup steps, API notes, and project walkthroughs to make the work recruiter-readable.`,
        ],
      },
      {
        title: isData ? 'Data Analytics Project Intern' : 'Product Engineering Intern',
        company: 'Campus Innovation Cell',
        location: account.location,
        start_date: 'Aug 2025',
        end_date: 'Dec 2025',
        bullets: [
          `Designed a ${isData ? 'student placement analytics report' : 'student dashboard prototype'} for 120+ sample profiles using ${account.matched.slice(0, 3).join(', ')}.`,
          `Created reusable templates for weekly progress reviews, reducing manual tracking effort by 30%.`,
          `Collaborated with peers to review requirements, prioritize features, and present a working demo to mentors.`,
          `Maintained structured issue notes, sprint checklist, and final handoff documentation for future batches.`,
        ],
      },
    ],
    education: [
      {
        degree: account.degree,
        institution: account.college,
        location: account.location,
        graduation: String(account.graduationYear),
        cgpa: '8.4/10',
        relevant_courses: isData
          ? ['Data Structures', 'Probability & Statistics', 'Machine Learning', 'Database Systems', 'Data Visualization']
          : ['Data Structures', 'DBMS', 'Operating Systems', 'Computer Networks', 'Software Engineering'],
      },
    ],
    projects: account.projects.map((project) => ({
      name: project.title,
      tech_stack: project.stack.join(', '),
      github_url: `https://github.com/${account.github}/${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      live_url: account.portfolio,
      bullets: [
        `${project.description} Shipped a working prototype with authentication, data views, and polished demo states.`,
        `Implemented core flows, validation, analytics, and ${isData ? 'model/report evaluation' : 'responsive UI'} with clear success metrics.`,
        `Documented setup, architecture, screenshots, limitations, and next iteration plan for recruiter review.`,
      ],
    })),
    certifications: [
      { name: `${account.resumeTitle} Career Track`, issuer: 'ZeroGap Academy', date: 'Apr 2026', url: account.portfolio },
      { name: 'GitHub Proof Review', issuer: 'ZeroGap Mentor', date: 'May 2026', url: `https://github.com/${account.github}` },
      { name: isData ? 'Applied Machine Learning Foundations' : 'Full Stack Project Foundations', issuer: 'ZeroGap Labs', date: 'Mar 2026', url: account.portfolio },
    ],
    achievements: [
      `${account.xp.streak}-day execution streak with ${account.xp.total}+ XP earned through roadmap tasks, proof logs, and project work.`,
      `Ranked in the top ${100 - account.benchmark.national}% national readiness band for ${account.targetRole} demo benchmarks.`,
      `Built ${account.projects.length} portfolio projects aligned to live market skill gaps and interview discussion points.`,
      `Matched ${account.matched.length} required skills and converted ${account.partial.length} partial skills into weekly learning targets.`,
      `${firstName} maintains a recruiter-ready profile with resume, GitHub proof, job matches, and consistency analytics.`,
    ],
  };
}

async function seedAccount(account, achievementIds, jobRows) {
  const user = await upsertAuthUser(account);
  const userId = user.id;

  await resetUserRows(userId);

  await check('upsert profile', admin.from('profiles').upsert({
    id: userId,
    email: account.email,
    full_name: account.name,
    avatar_url: null,
    role: 'student',
    college_name: account.college,
    degree: account.degree,
    graduation_year: account.graduationYear,
    location: account.location,
    bio: `${account.targetRole} demo profile with rich seeded data across roadmap, jobs, resume, tracker, achievements, and projects.`,
    learning_style: account.learningStyle,
    time_availability_hours: account.hours,
    github_username: account.github,
    linkedin_url: account.linkedin,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }));

  await optional('profile optional polish', admin.from('profiles').update({
    phone: '+91 98765 43210',
    portfolio_url: account.portfolio,
    total_xp_cached: account.xp.total,
  }).eq('id', userId));

  await check('insert active target role', admin.from('target_roles').insert({
    user_id: userId,
    job_title: account.targetRole,
    specialization: account.specialization,
    experience_level: 'fresher',
    is_active: true,
  }).select().single()).then(async ({ data: targetRole }) => {
    await check('upsert user xp', admin.from('user_xp').upsert({
      user_id: userId,
      total_xp: account.xp.total,
      current_level: account.xp.level,
      current_streak_days: account.xp.streak,
      longest_streak_days: account.xp.longest,
      last_active_date: dateOnly(0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }));

    await check('upsert skills', admin.from('user_skills').upsert(asRows(account, userId), { onConflict: 'user_id,skill_name' }));

    await check('insert skill gap analysis', admin.from('skill_gap_analyses').insert({
      user_id: userId,
      target_role_id: targetRole.id,
      skill_score: account.score.final,
      matched_skills: account.matched,
      missing_skills: account.missing,
      partial_skills: account.partial,
      skills_match_percentage: account.score.skills,
      project_quality_score: account.score.project,
      activity_consistency_score: account.score.activity,
      analysis_data: {
        headline: `${account.name} is close to ${account.targetRole} readiness.`,
        next_focus: account.missing,
        market_signal: 'High demand in India',
      },
      created_at: new Date().toISOString(),
    }));

    await optional('insert score history', admin.from('score_history').insert(
      [28, 21, 14, 7, 0].map((days, index) => ({
        user_id: userId,
        score: Math.max(35, account.score.final - (4 - index) * 4),
        skills_match_pct: Math.max(30, account.score.skills - (4 - index) * 5),
        project_quality: Math.max(25, account.score.project - (4 - index) * 6),
        activity_consistency: Math.max(25, account.score.activity - (4 - index) * 4),
        recorded_at: daysAgo(days),
      })),
    ));

    await check('upsert peer benchmark', admin.from('peer_benchmarks').upsert({
      user_id: userId,
      target_role: account.targetRole,
      college_name: account.college,
      college_percentile: account.benchmark.college,
      branch_percentile: Math.max(70, account.benchmark.college - 3),
      national_percentile: account.benchmark.national,
      avg_college_score: account.benchmark.avgCollege,
      avg_national_score: account.benchmark.avgNational,
      ranking_data: {
        total_role_users: 12840,
        total_college_users: 418,
        rank_label: 'top performer',
      },
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }));

    await check('insert failure prediction', admin.from('failure_predictions').insert({
      user_id: userId,
      risk_level: account.risk.level,
      ready_in_months: account.risk.months,
      risk_factors: account.missing.map((skill) => `Improve ${skill} proof`),
      action_suggestions: [
        `Complete one ${account.missing[0] ?? account.targetRole} project this week`,
        'Tailor resume to top 5 job matches',
        'Log 60 minutes of focused execution daily',
      ],
      success_probability: account.risk.probability,
      predicted_at: new Date().toISOString(),
    }));

    const stagesForAccount = roadmapStages(account);
    const roadmapCompletion = Math.round(stagesForAccount.reduce((sum, stage) => sum + stage.completion, 0) / stagesForAccount.length);
    const { data: roadmap } = await check('insert roadmap', admin.from('roadmaps').insert({
      user_id: userId,
      target_role_id: targetRole.id,
      title: `${account.targetRole} Job-Ready Roadmap`,
      total_stages: 4,
      estimated_weeks: 8,
      is_active: true,
      completion_percentage: roadmapCompletion,
      generated_by_ai: true,
      created_at: daysAgo(20),
      updated_at: new Date().toISOString(),
    }).select().single());

    for (const [stageIndex, stage] of stagesForAccount.entries()) {
      const { data: stageRow } = await check(`insert roadmap stage ${stage.title}`, admin.from('roadmap_stages').insert({
        roadmap_id: roadmap.id,
        stage_number: stageIndex + 1,
        title: stage.title,
        description: stage.description,
        skills_to_learn: stage.skills_to_learn,
        resources: [
          { name: 'Official Docs', url: 'https://developer.mozilla.org/', type: 'article', platform: 'MDN', is_free: true },
          { name: 'ZeroGap Mentor Notes', url: 'https://zerogap-frontend-002.vercel.app/mentor', type: 'course', platform: 'ZeroGap', is_free: true },
        ],
        projects: account.projects.map((project) => ({
          name: project.title,
          description: project.description,
          skills_practiced: project.stack,
          difficulty: project.difficulty,
          github_template_url: `https://github.com/${account.github}`,
        })),
        estimated_weeks: 2,
        is_completed: stage.completion === 100,
        completion_percentage: stage.completion,
        order_index: stageIndex,
      }).select().single());

      for (const [taskIndex, task] of stage.tasks.entries()) {
        await check(`insert task ${task[0]}`, admin.from('roadmap_tasks').insert({
          stage_id: stageRow.id,
          user_id: userId,
          title: task[0],
          description: `${task[0]} for ${account.targetRole}`,
          task_type: task[1],
          resource_url: account.portfolio,
          estimated_hours: taskIndex + 1,
          is_completed: task[2],
          completed_at: task[2] ? daysAgo(10 - stageIndex * 2 - taskIndex) : null,
          proof_url: task[2] ? account.portfolio : null,
          xp_reward: task[3],
          created_at: daysAgo(20 - stageIndex * 3),
        }));
      }
    }

    await check('insert certificates', admin.from('certificates').insert([
      {
        user_id: userId,
        title: `${account.targetRole} Career Track`,
        issuer: 'ZeroGap Academy',
        issue_date: dateOnly(18),
        credential_url: account.portfolio,
        skills_validated: account.matched.slice(0, 5),
        verified: true,
      },
      {
        user_id: userId,
        title: 'GitHub Proof Review',
        issuer: 'ZeroGap Mentor',
        issue_date: dateOnly(9),
        credential_url: `https://github.com/${account.github}`,
        skills_validated: account.skills.slice(0, 4).map(([skill]) => skill),
        verified: true,
      },
    ]));

    await check('upsert github proofs', admin.from('github_proofs').upsert(account.projects.map((project) => ({
      user_id: userId,
      repo_name: project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      repo_url: `https://github.com/${account.github}/${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      language: account.targetRole === 'Data Scientist' ? 'Python' : 'TypeScript',
      stars: account.targetRole === 'Data Scientist' ? 38 : 54,
      commits: account.targetRole === 'Data Scientist' ? 126 : 148,
      quality_score: account.score.project,
      skills_detected: project.stack,
      complexity_score: Math.min(96, account.score.project + 8),
      last_synced: new Date().toISOString(),
    })), { onConflict: 'user_id,repo_name' }));

    await check('insert generated projects', admin.from('generated_projects').insert(account.projects.map((project) => ({
      user_id: userId,
      project_title: project.title,
      description: project.description,
      tech_stack: project.stack,
      skills_practiced: project.stack,
      difficulty_level: project.difficulty,
      starter_code_url: `https://github.com/${account.github}`,
      github_template_url: `https://github.com/${account.github}`,
      step_by_step_guide: [
        'Define product scope and target user',
        'Design schema, API contract, and core UI states',
        'Build MVP with auth, dashboard, and proof capture',
        'Add analytics, tests, and deployment notes',
        'Ship live demo and write README',
      ],
      is_github_ready: true,
      created_at: daysAgo(6),
    }))));

    const content = resumeContent(account);
    const resumeInsert = {
      user_id: userId,
      target_role_id: targetRole.id,
      content_json: content,
      ats_score: Math.min(97, account.score.final + 8),
      keyword_match_score: account.score.skills,
      pdf_url: null,
      version: 1,
      is_latest: true,
      created_at: daysAgo(1),
      template_name: 'jake',
    };
    const resumeResult = await admin.from('resumes').insert(resumeInsert);
    if (resumeResult.error) {
      const { template_name: _template, ...baseResume } = resumeInsert;
      await check('insert resume fallback', admin.from('resumes').insert(baseResume));
    }

    await check('insert chat session', admin.from('chat_sessions').insert({
      user_id: userId,
      title: `${account.targetRole} Mentor Plan`,
      context_type: 'roadmap',
      created_at: daysAgo(3),
      last_message_at: new Date().toISOString(),
    }).select().single()).then(async ({ data: session }) => {
      await check('insert chat messages', admin.from('chat_messages').insert([
        {
          session_id: session.id,
          user_id: userId,
          role: 'user',
          content: 'What should I focus on this week?',
          created_at: daysAgo(1),
        },
        {
          session_id: session.id,
          user_id: userId,
          role: 'assistant',
          content: `Focus on ${account.missing[0] ?? account.targetRole} proof. Complete one roadmap task, update your resume keywords, and apply to the top-fit roles in Hire Me mode today.`,
          created_at: new Date().toISOString(),
        },
      ]));
    });

    const activityActions = [
      'Completed roadmap sprint',
      'Improved portfolio proof',
      'Practiced interview questions',
      'Updated ATS resume bullets',
      'Reviewed job match requirements',
      'Added GitHub proof notes',
    ];
    const activityRows = Array.from({ length: Math.max(30, account.xp.streak) }, (_, index) => {
      const day = Math.max(30, account.xp.streak) - index - 1;
      const rowsToday = day <= 6 ? 2 : 1;
      return Array.from({ length: rowsToday }, (__, rowIndex) => ({
          user_id: userId,
          action: activityActions[(index + rowIndex) % activityActions.length],
          time_spent_minutes: 45 + ((index + rowIndex) % 4) * 15,
          output_description: `${account.name.split(' ')[0]} worked on ${account.targetRole} proof, roadmap output, and recruiter-ready notes.`,
          proof_url: account.portfolio,
          date: dateOnly(day),
          xp_earned: 25 + ((index + rowIndex) % 3) * 10,
          created_at: daysAgo(day),
        }));
    }).flat();
    await check('insert activity logs', admin.from('execution_logs').insert(activityRows));

    await check('insert job matches', admin.from('user_job_matches').upsert(
      jobRows
        .filter((job) => {
          const text = `${job.title} ${(job.skills_required ?? []).join(' ')}`.toLowerCase();
          return account.targetRole === 'Data Scientist'
            ? text.includes('data') || text.includes('ml') || text.includes('python')
            : text.includes('full') || text.includes('software') || text.includes('frontend') || text.includes('node');
        })
        .slice(0, 3)
        .map((job, index) => {
          const required = Array.isArray(job.skills_required) ? job.skills_required : [];
          const userSkillNames = new Set(account.skills.map(([skill]) => String(skill).toLowerCase()));
          const missing = required.filter((skill) => !userSkillNames.has(String(skill).toLowerCase()));
          return {
            user_id: userId,
            job_listing_id: job.id,
            fit_percentage: Math.max(62, 94 - index * 9 - missing.length * 3),
            missing_skills: missing.slice(0, 4),
            next_steps: missing.slice(0, 3).map((skill) => `Build proof for ${skill}`),
            match_reason: `${account.name.split(' ')[0]} matches the core ${account.targetRole} skill profile.`,
            saved: index === 0,
            applied: index === 1,
          };
        }),
      { onConflict: 'user_id,job_listing_id' },
    ));

    await check('insert achievements earned', admin.from('user_achievements').upsert(
      Object.values(achievementIds).map((achievement_id) => ({
        user_id: userId,
        achievement_id,
        earned_at: daysAgo(Math.floor(Math.random() * 12)),
      })),
      { onConflict: 'user_id,achievement_id' },
    ));

    await optional('insert notifications', admin.from('notifications').insert([
      {
        user_id: userId,
        type: 'score_update',
        title: `Readiness score is ${account.score.final}`,
        message: `You are trending toward ${account.targetRole} readiness.`,
        is_read: false,
        action_url: '/dashboard',
      },
      {
        user_id: userId,
        type: 'job_match',
        title: 'High-fit jobs found',
        message: 'Hire Me mode has new roles with direct apply links.',
        is_read: false,
        action_url: '/jobs',
      },
    ]));
  });

  const login = await anon.auth.signInWithPassword({ email: account.email, password: account.password });
  if (login.error) throw new Error(`Login verify failed for ${account.email}: ${login.error.message}`);

  console.log(`Seeded ${account.name} -> ${account.email}`);
}

async function main() {
  await seedGlobalRows();

  const { data: achievements, error: achievementError } = await admin.from('achievements').select('id,name');
  if (achievementError) throw achievementError;
  const achievementIds = Object.fromEntries((achievements ?? []).map((item) => [item.name, item.id]));

  const { data: jobs, error: jobsError } = await admin.from('job_listings').select('*').in('external_id', JOBS.map((job) => job.external_id));
  if (jobsError) throw jobsError;

  for (const account of DEMO_ACCOUNTS) {
    await seedAccount(account, achievementIds, jobs ?? []);
  }

  console.log('\nDemo accounts ready:');
  for (const account of DEMO_ACCOUNTS) {
    console.log(`${account.name} | ${account.email} | ${account.password} | ${account.targetRole}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
