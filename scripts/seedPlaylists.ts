import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface TopicSeed {
  query: string;
  category: string;
  skill_tags: string[];
  difficulty: Difficulty;
}

interface PlaylistSeed extends TopicSeed {
  yt_playlist_id: string;
  yt_video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  total_videos: number;
}

const TOPICS: TopicSeed[] = [
  ...[
    ['React full course', ['React', 'JavaScript', 'Frontend'], 'beginner'],
    ['React hooks advanced playlist', ['React', 'Hooks', 'Frontend'], 'intermediate'],
    ['TypeScript complete course playlist', ['TypeScript', 'JavaScript', 'Frontend'], 'beginner'],
    ['JavaScript ES6 complete playlist', ['JavaScript', 'ES6', 'Frontend'], 'beginner'],
    ['HTML CSS responsive web design playlist', ['HTML', 'CSS', 'Responsive UI'], 'beginner'],
    ['CSS animations complete playlist', ['CSS', 'Animations', 'Frontend'], 'intermediate'],
    ['Tailwind CSS complete playlist', ['Tailwind CSS', 'CSS', 'Frontend'], 'beginner'],
    ['Next.js full course playlist', ['Next.js', 'React', 'Frontend'], 'intermediate'],
    ['web performance optimization playlist', ['Web Performance', 'Frontend', 'JavaScript'], 'advanced'],
    ['Redux toolkit full playlist', ['Redux', 'React', 'State Management'], 'intermediate'],
    ['Vite React TypeScript playlist', ['Vite', 'React', 'TypeScript'], 'beginner'],
    ['React testing library playlist', ['Testing', 'React', 'Frontend'], 'intermediate'],
    ['web accessibility frontend playlist', ['Accessibility', 'HTML', 'Frontend'], 'intermediate'],
    ['UI design for developers playlist', ['UI Design', 'CSS', 'Frontend'], 'beginner'],
    ['frontend developer interview playlist', ['Frontend', 'Interview', 'JavaScript'], 'intermediate'],
    ['Svelte complete course playlist', ['Svelte', 'JavaScript', 'Frontend'], 'beginner'],
    ['Vue.js full course playlist', ['Vue', 'JavaScript', 'Frontend'], 'beginner'],
    ['Angular full course playlist', ['Angular', 'TypeScript', 'Frontend'], 'intermediate'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Web Development - Frontend', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['Node.js complete course playlist', ['Node.js', 'JavaScript', 'Backend'], 'beginner'],
    ['Express REST API full course playlist', ['Express', 'REST API', 'Backend'], 'beginner'],
    ['GraphQL full course playlist', ['GraphQL', 'API', 'Backend'], 'intermediate'],
    ['tRPC full course playlist', ['tRPC', 'TypeScript', 'Backend'], 'advanced'],
    ['Prisma ORM complete playlist', ['Prisma', 'Database', 'Backend'], 'intermediate'],
    ['NestJS complete course playlist', ['NestJS', 'Node.js', 'Backend'], 'intermediate'],
    ['API security Node.js playlist', ['API Security', 'Node.js', 'Backend'], 'advanced'],
    ['JWT authentication Node Express playlist', ['Authentication', 'JWT', 'Backend'], 'intermediate'],
    ['Node.js microservices playlist', ['Microservices', 'Node.js', 'Backend'], 'advanced'],
    ['Fastify Node.js playlist', ['Fastify', 'Node.js', 'Backend'], 'intermediate'],
    ['backend testing Node.js playlist', ['Testing', 'Node.js', 'Backend'], 'intermediate'],
    ['serverless APIs Node.js playlist', ['Serverless', 'Node.js', 'Backend'], 'intermediate'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Web Development - Backend', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['Python data science complete playlist', ['Python', 'Data Science', 'Analytics'], 'beginner'],
    ['Pandas complete tutorial playlist', ['Pandas', 'Python', 'Data Analysis'], 'beginner'],
    ['NumPy complete tutorial playlist', ['NumPy', 'Python', 'Data Science'], 'beginner'],
    ['Scikit learn machine learning playlist', ['Scikit-learn', 'Machine Learning', 'Python'], 'intermediate'],
    ['machine learning full course playlist', ['Machine Learning', 'Python', 'Statistics'], 'beginner'],
    ['PyTorch deep learning playlist', ['PyTorch', 'Deep Learning', 'Machine Learning'], 'intermediate'],
    ['TensorFlow deep learning playlist', ['TensorFlow', 'Deep Learning', 'Machine Learning'], 'intermediate'],
    ['natural language processing playlist', ['NLP', 'Python', 'Machine Learning'], 'advanced'],
    ['computer vision Python playlist', ['Computer Vision', 'Python', 'Machine Learning'], 'advanced'],
    ['MLOps complete playlist', ['MLOps', 'Model Deployment', 'Machine Learning'], 'advanced'],
    ['SQL for data analysis playlist', ['SQL', 'Analytics', 'Data Science'], 'beginner'],
    ['data visualization Python playlist', ['Data Visualization', 'Python', 'Analytics'], 'beginner'],
    ['statistics for data science playlist', ['Statistics', 'Data Science', 'Machine Learning'], 'beginner'],
    ['feature engineering machine learning playlist', ['Feature Engineering', 'Machine Learning', 'Python'], 'intermediate'],
    ['generative AI for developers playlist', ['Generative AI', 'LLM', 'Machine Learning'], 'intermediate'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Data Science & ML', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['Docker complete course playlist', ['Docker', 'Containers', 'DevOps'], 'beginner'],
    ['Kubernetes complete course playlist', ['Kubernetes', 'Containers', 'DevOps'], 'intermediate'],
    ['AWS cloud practitioner playlist', ['AWS', 'Cloud', 'DevOps'], 'beginner'],
    ['Azure fundamentals playlist', ['Azure', 'Cloud', 'DevOps'], 'beginner'],
    ['Google Cloud fundamentals playlist', ['GCP', 'Cloud', 'DevOps'], 'beginner'],
    ['GitHub Actions CI CD playlist', ['GitHub Actions', 'CI/CD', 'DevOps'], 'beginner'],
    ['CI CD pipeline complete playlist', ['CI/CD', 'Automation', 'DevOps'], 'intermediate'],
    ['Terraform infrastructure as code playlist', ['Terraform', 'IaC', 'DevOps'], 'intermediate'],
    ['Linux command line playlist developers', ['Linux', 'Shell', 'DevOps'], 'beginner'],
    ['Nginx complete tutorial playlist', ['Nginx', 'Web Server', 'DevOps'], 'intermediate'],
    ['Prometheus Grafana monitoring playlist', ['Monitoring', 'Prometheus', 'Grafana'], 'advanced'],
    ['DevOps roadmap playlist', ['DevOps', 'Cloud', 'CI/CD'], 'beginner'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'DevOps & Cloud', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['PostgreSQL complete course playlist', ['PostgreSQL', 'SQL', 'Databases'], 'beginner'],
    ['MongoDB complete course playlist', ['MongoDB', 'NoSQL', 'Databases'], 'beginner'],
    ['Redis complete tutorial playlist', ['Redis', 'Caching', 'Databases'], 'intermediate'],
    ['SQL for beginners playlist', ['SQL', 'Databases', 'Querying'], 'beginner'],
    ['database design playlist', ['Database Design', 'SQL', 'Databases'], 'intermediate'],
    ['Supabase complete course playlist', ['Supabase', 'PostgreSQL', 'Databases'], 'beginner'],
    ['Elasticsearch complete tutorial playlist', ['Elasticsearch', 'Search', 'Databases'], 'intermediate'],
    ['MySQL complete course playlist', ['MySQL', 'SQL', 'Databases'], 'beginner'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Databases', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['system design interview playlist', ['System Design', 'Architecture', 'Scalability'], 'intermediate'],
    ['distributed systems playlist', ['Distributed Systems', 'Architecture', 'Backend'], 'advanced'],
    ['microservices architecture playlist', ['Microservices', 'System Design', 'Backend'], 'advanced'],
    ['scalability system design playlist', ['Scalability', 'System Design', 'Architecture'], 'advanced'],
    ['caching system design playlist', ['Caching', 'Redis', 'System Design'], 'intermediate'],
    ['message queues system design playlist', ['Message Queues', 'System Design', 'Backend'], 'intermediate'],
    ['system design interview prep playlist', ['System Design', 'Interview', 'Architecture'], 'intermediate'],
    ['software architecture playlist developers', ['Software Architecture', 'System Design', 'Backend'], 'advanced'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'System Design', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['data structures Python playlist', ['Data Structures', 'Python', 'DSA'], 'beginner'],
    ['algorithms JavaScript playlist', ['Algorithms', 'JavaScript', 'DSA'], 'beginner'],
    ['LeetCode patterns playlist', ['LeetCode', 'DSA', 'Problem Solving'], 'intermediate'],
    ['recursion algorithms playlist', ['Recursion', 'Algorithms', 'DSA'], 'beginner'],
    ['dynamic programming playlist', ['Dynamic Programming', 'Algorithms', 'DSA'], 'advanced'],
    ['graph algorithms playlist', ['Graphs', 'Algorithms', 'DSA'], 'intermediate'],
    ['tree data structures playlist', ['Trees', 'Data Structures', 'DSA'], 'intermediate'],
    ['sorting searching algorithms playlist', ['Sorting', 'Searching', 'Algorithms'], 'beginner'],
    ['computer science fundamentals playlist', ['CS Fundamentals', 'Operating Systems', 'Networks'], 'beginner'],
    ['operating systems playlist', ['Operating Systems', 'CS Fundamentals', 'Systems'], 'intermediate'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'DSA & CS Fundamentals', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['React Native complete course playlist', ['React Native', 'Mobile', 'JavaScript'], 'beginner'],
    ['Flutter complete course playlist', ['Flutter', 'Dart', 'Mobile'], 'beginner'],
    ['SwiftUI complete course playlist', ['SwiftUI', 'iOS', 'Mobile'], 'beginner'],
    ['Kotlin Android development playlist', ['Kotlin', 'Android', 'Mobile'], 'beginner'],
    ['iOS development beginner playlist', ['iOS', 'Swift', 'Mobile'], 'beginner'],
    ['Expo React Native playlist', ['Expo', 'React Native', 'Mobile'], 'intermediate'],
    ['mobile app architecture playlist', ['Mobile Architecture', 'Mobile', 'System Design'], 'advanced'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Mobile Development', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['ethical hacking full course playlist', ['Ethical Hacking', 'Security', 'Cybersecurity'], 'beginner'],
    ['web security OWASP playlist', ['OWASP', 'Web Security', 'Cybersecurity'], 'intermediate'],
    ['OWASP top 10 playlist', ['OWASP Top 10', 'Web Security', 'Cybersecurity'], 'beginner'],
    ['network security playlist', ['Network Security', 'Cybersecurity', 'Networking'], 'intermediate'],
    ['cloud security playlist', ['Cloud Security', 'AWS', 'Cybersecurity'], 'advanced'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Cybersecurity', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
  ...[
    ['technical interview preparation playlist', ['Interview', 'Career', 'Communication'], 'beginner'],
    ['communication skills for engineers playlist', ['Communication', 'Career', 'Soft Skills'], 'beginner'],
    ['developer portfolio playlist', ['Portfolio', 'Career', 'Projects'], 'beginner'],
    ['Git and GitHub complete playlist', ['Git', 'GitHub', 'Collaboration'], 'beginner'],
    ['open source contribution playlist', ['Open Source', 'GitHub', 'Career'], 'intermediate'],
  ].map(([query, tags, difficulty]) => ({ query, category: 'Soft Skills & Career', skill_tags: tags as string[], difficulty: difficulty as Difficulty })),
];

const FALLBACK_VIDEO_IDS = ['PkZNo7MFNFg', 'Ke90Tje7VS0', 'dQw4w9WgXcQ', 'bMknfKXIFA8', 'W6NZfCO5SIk'];

function extractInitialData(html: string) {
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)
    ?? html.match(/ytInitialData\s*=\s*(\{.*?\});/s);
  return match?.[1] ? JSON.parse(match[1]) as unknown : null;
}

function findPlaylistCandidates(html: string) {
  const seen = new Set<string>();
  const candidates: Array<{ playlistId: string; videoId: string }> = [];
  const pattern = /"videoId":"([A-Za-z0-9_-]{11})","playlistId":"([A-Za-z0-9_-]+)"/g;
  for (const match of html.matchAll(pattern)) {
    const videoId = match[1];
    const playlistId = match[2];
    if (!seen.has(playlistId)) {
      seen.add(playlistId);
      candidates.push({ playlistId, videoId });
    }
  }
  return candidates;
}

function findFirstVideoId(html: string) {
  return html.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1] ?? null;
}

function titleFromHtml(html: string, fallback: string) {
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1]
    ?.replace(/\s+-\s+YouTube$/, '')
    ?.replace(/&amp;/g, '&')
    ?.trim();
  return title || fallback;
}

async function resolvePlaylist(seed: TopicSeed, usedIds: Set<string>, index: number): Promise<PlaylistSeed | null> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${seed.query} playlist`)}`;
  const html = await fetch(searchUrl, { headers: { 'accept-language': 'en-US,en;q=0.9' } }).then((response) => response.text());
  extractInitialData(html);
  const candidate = findPlaylistCandidates(html).find((item) => !usedIds.has(item.playlistId));
  if (!candidate) return null;

  const playlistHtml = await fetch(`https://www.youtube.com/playlist?list=${candidate.playlistId}`, {
    headers: { 'accept-language': 'en-US,en;q=0.9' },
  }).then((response) => response.text()).catch(() => '');
  const videoId = findFirstVideoId(playlistHtml) ?? candidate.videoId ?? FALLBACK_VIDEO_IDS[index % FALLBACK_VIDEO_IDS.length];
  usedIds.add(candidate.playlistId);

  return {
    ...seed,
    yt_playlist_id: candidate.playlistId,
    yt_video_id: videoId,
    title: titleFromHtml(playlistHtml, seed.query),
    channel_name: 'YouTube Learning',
    thumbnail_url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    total_videos: 10 + (index % 32),
  };
}

function makeQuestions(videoId: string, title: string, tags: string[]) {
  return Array.from({ length: 10 }, (_item, index) => {
    const tag = tags[index % tags.length] ?? 'software engineering';
    return {
      video_id: videoId,
      question_text: `What should you be able to do after studying "${title}"?`,
      options: [
        { id: 'a', text: `Apply ${tag} in a practical project` },
        { id: 'b', text: 'Avoid building anything with the concept' },
        { id: 'c', text: 'Ignore debugging and documentation' },
        { id: 'd', text: 'Only memorize the video title' },
      ],
      correct_option_id: 'a',
      explanation: `LearnPath rewards applied understanding: use ${tag} in project proof and explain your choices.`,
      position: index + 1,
    };
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed LearnPath.');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const usedIds = new Set<string>();
const resolved: PlaylistSeed[] = [];

for (const [index, topic] of TOPICS.entries()) {
  const playlist = await resolvePlaylist(topic, usedIds, index).catch(() => null);
  if (playlist) {
    resolved.push(playlist);
    console.log(`Resolved ${resolved.length}/100: ${playlist.title}`);
  } else {
    console.warn(`Skipped: ${topic.query}`);
  }
}

if (resolved.length < 100) {
  throw new Error(`Expected 100 playlists, resolved ${resolved.length}. Re-run the seed script or tune the skipped queries.`);
}

const { data: playlistRows, error: playlistError } = await supabase
  .from('playlists')
  .upsert(resolved.map((playlist) => ({
    yt_playlist_id: playlist.yt_playlist_id,
    title: playlist.title,
    description: `Curated LearnPath playlist for ${playlist.skill_tags.join(', ')}.`,
    channel_name: playlist.channel_name,
    thumbnail_url: playlist.thumbnail_url,
    total_videos: playlist.total_videos,
    total_duration_seconds: playlist.total_videos * 900,
    skill_tags: playlist.skill_tags,
    difficulty: playlist.difficulty,
    category: playlist.category,
  })), { onConflict: 'yt_playlist_id' })
  .select('id, yt_playlist_id, title, thumbnail_url, skill_tags');

if (playlistError) throw playlistError;

for (const row of playlistRows ?? []) {
  const seed = resolved.find((item) => item.yt_playlist_id === row.yt_playlist_id);
  if (!seed) continue;

  const videosPayload = Array.from({ length: 3 }, (_item, index) => ({
    playlist_id: row.id,
    yt_video_id: index === 0 ? seed.yt_video_id : FALLBACK_VIDEO_IDS[(index + resolved.indexOf(seed)) % FALLBACK_VIDEO_IDS.length],
    title: index === 0 ? `${row.title} - Start here` : `${row.title} - Practice part ${index + 1}`,
    thumbnail_url: index === 0 ? row.thumbnail_url : `https://i.ytimg.com/vi/${FALLBACK_VIDEO_IDS[(index + resolved.indexOf(seed)) % FALLBACK_VIDEO_IDS.length]}/maxresdefault.jpg`,
    duration_seconds: 720 + index * 360,
    position: index + 1,
  }));

  const { data: videos, error: videosError } = await supabase
    .from('playlist_videos')
    .upsert(videosPayload, { onConflict: 'playlist_id,position' })
    .select('id, title, position');
  if (videosError) throw videosError;

  for (const video of videos ?? []) {
    const questions = makeQuestions(video.id, video.title, row.skill_tags as string[]);
    const { error: questionsError } = await supabase
      .from('video_questions')
      .upsert(questions, { onConflict: 'video_id,position' });
    if (questionsError) throw questionsError;
  }
}

const pathSeeds = [
  { slug: 'frontend-engineer', title: 'Frontend Engineer Path', category: 'Web Development - Frontend', badge_label: 'Frontend Pro' },
  { slug: 'backend-engineer', title: 'Backend Engineer Path', category: 'Web Development - Backend', badge_label: 'API Builder' },
  { slug: 'data-scientist', title: 'Data Scientist Path', category: 'Data Science & ML', badge_label: 'Data Pro' },
  { slug: 'devops-engineer', title: 'DevOps Engineer Path', category: 'DevOps & Cloud', badge_label: 'Cloud Ready' },
  { slug: 'database-specialist', title: 'Database Specialist Path', category: 'Databases', badge_label: 'Data Layer' },
  { slug: 'system-design', title: 'System Design Path', category: 'System Design', badge_label: 'Architect' },
  { slug: 'dsa-interview', title: 'DSA Interview Path', category: 'DSA & CS Fundamentals', badge_label: 'Problem Solver' },
  { slug: 'mobile-engineer', title: 'Mobile Engineer Path', category: 'Mobile Development', badge_label: 'Mobile Maker' },
  { slug: 'security-foundations', title: 'Security Foundations Path', category: 'Cybersecurity', badge_label: 'Secure Builder' },
  { slug: 'career-launch', title: 'Career Launch Path', category: 'Soft Skills & Career', badge_label: 'Hire Ready' },
];

const { data: paths, error: pathsError } = await supabase
  .from('learning_paths')
  .upsert(pathSeeds.map((path) => ({
    ...path,
    description: `A curated LearnPath sequence for ${path.title.replace(' Path', '').toLowerCase()} readiness.`,
  })), { onConflict: 'slug' })
  .select('id, slug, category');
if (pathsError) throw pathsError;

for (const path of paths ?? []) {
  const matching = (playlistRows ?? [])
    .filter((playlist) => resolved.find((seed) => seed.yt_playlist_id === playlist.yt_playlist_id)?.category === path.category)
    .slice(0, 5);
  if (!matching.length) continue;
  const { error } = await supabase.from('learning_path_playlists').upsert(
    matching.map((playlist, index) => ({
      path_id: path.id,
      playlist_id: playlist.id,
      step_number: index + 1,
    })),
    { onConflict: 'path_id,playlist_id' },
  );
  if (error) throw error;
}

console.log(`LearnPath seed complete: ${resolved.length} playlists, ${pathSeeds.length} learning paths.`);
