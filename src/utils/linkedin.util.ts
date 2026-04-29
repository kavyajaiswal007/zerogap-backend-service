export async function importLinkedInData(input: {
  linkedinUrl?: string;
  headline?: string;
  summary?: string;
  skills?: string[];
}) {
  return {
    linkedinUrl: input.linkedinUrl ?? null,
    headline: input.headline ?? null,
    summary: input.summary ?? null,
    skills: input.skills ?? [],
  };
}
