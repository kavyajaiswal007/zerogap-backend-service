import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';

const COMMON_SKILL_MAP: Record<string, string[]> = {
  TypeScript: ['TypeScript', 'JavaScript', 'Node.js'],
  JavaScript: ['JavaScript', 'Web Development'],
  Python: ['Python'],
  Java: ['Java'],
  Go: ['Go'],
  Rust: ['Rust'],
  HTML: ['HTML', 'Frontend'],
  CSS: ['CSS', 'Frontend'],
};

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function qualityFromRepo(repo: any) {
  const score =
    Math.min(repo.stargazers_count * 5, 20) +
    Math.min(repo.forks_count * 4, 15) +
    (repo.description ? 10 : 0) +
    (repo.updated_at ? 20 : 0) +
    (repo.size > 0 ? Math.min(repo.size / 50, 35) : 0);

  return Math.max(10, Math.min(100, Number(score.toFixed(2))));
}

export async function syncGithubRepos(userId: string, accessToken: string) {
  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  const { data: repos } = await client.get('/user/repos', {
    params: { per_page: 100, sort: 'updated' },
  });

  const aggregatedSkills: string[] = [];

  for (const repo of repos) {
    const [languagesRes, commitsRes, readmeRes] = await Promise.allSettled([
      client.get(repo.languages_url),
      client.get(`/repos/${repo.owner.login}/${repo.name}/commits`, { params: { per_page: 100 } }),
      client.get(`/repos/${repo.owner.login}/${repo.name}/readme`, {
        headers: { Accept: 'application/vnd.github.raw+json' },
      }),
    ]);

    const languages = languagesRes.status === 'fulfilled' ? Object.keys(languagesRes.value.data) : [];
    const commits = commitsRes.status === 'fulfilled' ? commitsRes.value.data.length : 0;
    const hasReadme = readmeRes.status === 'fulfilled';
    const skillsDetected = dedupe(languages.flatMap((language) => COMMON_SKILL_MAP[language] ?? [language]));
    aggregatedSkills.push(...skillsDetected);

    await supabaseAdmin.from('github_proofs').upsert({
      user_id: userId,
      repo_name: repo.name,
      repo_url: repo.html_url,
      language: languages[0] ?? repo.language,
      stars: repo.stargazers_count ?? 0,
      commits,
      quality_score: qualityFromRepo({ ...repo, size: repo.size + (hasReadme ? 100 : 0) }),
      skills_detected: skillsDetected,
      complexity_score: Math.min(100, 20 + commits + languages.length * 10),
      last_synced: new Date().toISOString(),
    }, {
      onConflict: 'user_id,repo_name',
    });
  }

  return {
    reposProcessed: repos.length,
    skills: dedupe(aggregatedSkills),
  };
}
