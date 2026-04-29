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
    'You extract structured JSON from resumes.',
    `Extract from this resume: name, email, education, skills (with proficiency), work experience, projects, certifications.\n\nResume Text:\n${pdfResult.text}`,
    fallback,
  );
}
