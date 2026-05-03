import puppeteer from 'puppeteer';
import { getClaudeJson } from './claude.util.js';

export interface LinkedInProfile {
  name: string;
  headline: string;
  location: string;
  about: string;
  currentRole: string;
  currentCompany: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
    startDate: string;
    endDate: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    year: string;
  }>;
  skills: string[];
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  languages: string[];
  profileImageUrl: string;
}

const emptyLinkedInProfile: LinkedInProfile = {
  name: '',
  headline: '',
  location: '',
  about: '',
  currentRole: '',
  currentCompany: '',
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
  profileImageUrl: '',
};

const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function scrapeLinkedInPublicProfile(linkedinUrl: string): Promise<LinkedInProfile | null> {
  const normalized = linkedinUrl.trim();
  if (!normalized.includes('linkedin.com/in/')) {
    return null;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,900',
      `--user-agent=${userAgent}`,
    ],
    timeout: 30000,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    await page.goto(normalized, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const rawPageText = String(await page.evaluate(`(() => {
      document.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
      return document.body ? document.body.innerText : '';
    })()`) ?? '');

    await browser.close();

    if (!rawPageText || rawPageText.length < 200) {
      return null;
    }

    const system = `You are an expert at extracting structured data from LinkedIn profile page text.
Extract all available information and return a complete JSON object.
If a field is missing, use an empty string or empty array.
Never hallucinate information — only use what is in the text.
Return ONLY valid JSON, no markdown, no explanation.`;

    const prompt = `Extract the LinkedIn profile data from this page text.
Return this exact JSON structure:
{
  "name": "full name",
  "headline": "professional headline/title",
  "location": "city, country",
  "about": "about/summary section text",
  "currentRole": "current job title",
  "currentCompany": "current employer",
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "2 years 3 months",
      "description": "role description",
      "startDate": "Jan 2023",
      "endDate": "Present"
    }
  ],
  "education": [
    {
      "institution": "university name",
      "degree": "B.Tech / B.Sc etc",
      "field": "Computer Science",
      "year": "2025"
    }
  ],
  "skills": ["React", "Python", "SQL"],
  "certifications": [
    {
      "name": "AWS Cloud Practitioner",
      "issuer": "Amazon",
      "date": "2024"
    }
  ],
  "languages": ["English", "Hindi"],
  "profileImageUrl": ""
}

PAGE TEXT:
${rawPageText.slice(0, 8000)}`;

    return getClaudeJson<LinkedInProfile>(system, prompt, emptyLinkedInProfile);
  } catch {
    await browser.close().catch(() => {});
    return null;
  }
}

export async function enrichProfileWithAI(
  partial: Partial<LinkedInProfile>,
  targetRole: string,
): Promise<{
  predictedSkills: Array<{ skill_name: string; proficiency_level: number }>;
  predictedGaps: string[];
  suggestedRoadmap: string;
  careerSummary: string;
  predictedSalaryRange: string;
  topJobTitles: string[];
  relevantCertifications: string[];
  suggestedPlaylists: Array<{
    title: string;
    channel: string;
    url: string;
    reason: string;
  }>;
  relevantJobs: Array<{
    title: string;
    company: string;
    location: string;
    salaryRange: string;
    matchReason: string;
    applyUrl: string;
    skills: string[];
  }>;
}> {
  const system = `You are a career intelligence AI for ZeroGap, an employability platform for students.
Given a user's partial LinkedIn profile and target role, generate a complete career intelligence report.
Be specific, realistic, and data-driven. Return ONLY valid JSON.`;

  const prompt = `User Profile:
Name: ${partial.name || 'Unknown'}
Headline: ${partial.headline || 'Student'}
Current Role: ${partial.currentRole || 'Fresher'}
Education: ${JSON.stringify(partial.education || [])}
Skills (from LinkedIn): ${(partial.skills || []).join(', ')}
Experience: ${JSON.stringify((partial.experience || []).slice(0, 3))}
Certifications: ${JSON.stringify(partial.certifications || [])}
Target Role: ${targetRole}

Generate this JSON:
{
  "predictedSkills": [
    { "skill_name": "React", "proficiency_level": 75 }
  ],
  "predictedGaps": ["list of 5-8 specific skills they are likely missing for ${targetRole}"],
  "suggestedRoadmap": "3-line personalized roadmap recommendation",
  "careerSummary": "2 paragraph professional summary for their resume, first person, impressive",
  "predictedSalaryRange": "e.g. ₹6-12 LPA for India based on experience",
  "topJobTitles": ["5 job titles they should apply to"],
  "relevantCertifications": ["5 certifications they should earn for ${targetRole}"],
  "suggestedPlaylists": [
    {
      "title": "Complete React Course",
      "channel": "Traversy Media",
      "url": "https://www.youtube.com/watch?v=...",
      "reason": "Fills your React gap for ${targetRole}"
    }
  ],
  "relevantJobs": [
    {
      "title": "Frontend Developer",
      "company": "Razorpay",
      "location": "Bengaluru, India",
      "salaryRange": "12-18 LPA",
      "matchReason": "Matches your React and JS skills",
      "applyUrl": "https://www.linkedin.com/jobs/search/?keywords=Frontend+Developer",
      "skills": ["React", "TypeScript", "Node.js"]
    }
  ]
}

Generate 15-25 predicted skills, 10 real YouTube playlists from channels like freeCodeCamp, Traversy Media, Fireship, Kunal Kushwaha, Apna College, CodeWithHarry, The Net Ninja, and Codevolution, plus minimum 10 job entries using real Indian tech companies: Razorpay, Zepto, Meesho, CRED, Freshworks, Swiggy, PhonePe, Groww, Atlassian India, Infosys, TCS Digital, Wipro Elite, and Accenture.`;

  return getClaudeJson(system, prompt, {
    predictedSkills: [],
    predictedGaps: [],
    suggestedRoadmap: '',
    careerSummary: '',
    predictedSalaryRange: '₹4-8 LPA',
    topJobTitles: [],
    relevantCertifications: [],
    suggestedPlaylists: [],
    relevantJobs: [],
  });
}
