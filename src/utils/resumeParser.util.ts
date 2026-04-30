import pdf from 'pdf-parse';
import { getClaudeJson } from './claude.util.js';

export interface ParsedResumeData {
  name?: string;
  email?: string;
  education?: Array<{ institution: string; degree?: string; year?: number }>;
  skills?: Array<{ name: string; proficiency: number }>;
  work_experience?: Array<{ company: string; title: string; summary: string }>;
  projects?: Array<{ name: string; summary: string; skills: string[] }>;
  certifications?: Array<{ title: string; issuer?: string; credential_url?: string }>;
}

export async function parseResumeBuffer(buffer: Buffer): Promise<ParsedResumeData> {
  const pdfResult = await pdf(buffer);
  const fallback: ParsedResumeData = {
    skills: [],
    education: [],
    work_experience: [],
    projects: [],
    certifications: [],
  };

  return getClaudeJson<ParsedResumeData>(
    `Extract from this resume and return ONLY valid JSON (no markdown, no explanation):
{
  "basics": { "name", "email", "phone", "location", "linkedin", "github", "website" },
  "summary": "professional summary string",
  "education": [{ "institution", "degree", "field", "graduation_year", "gpa" }],
  "experience": [{ "company", "title", "start_date", "end_date", "description", "skills_used" }],
  "skills": [{ "skill_name", "proficiency_level": 0-100, "category" }],
  "projects": [{ "name", "description", "tech_stack", "url" }],
  "certifications": [{ "title", "issuer", "date", "url" }]
}`,
    `Resume Text:\n${pdfResult.text}`,
    fallback,
  );
}
