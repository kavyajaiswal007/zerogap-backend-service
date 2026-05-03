import { supabaseAdmin } from '../config/supabase.js';
import type { PlaylistRow, PlaylistVideoRow, VideoQuestionRow } from '../types/learnpath.types.js';
import { getClaudeJson } from './claude.util.js';
import { AppError } from './error.util.js';

interface GeneratedQuiz {
  questions: Array<{
    question_text: string;
    options: Array<{ id: string; text: string }>;
    correct_option_id: string;
    explanation: string;
  }>;
}

const OPTION_IDS = ['a', 'b', 'c', 'd'];

function fallbackQuestions(video: PlaylistVideoRow, playlist: PlaylistRow): GeneratedQuiz {
  return {
    questions: Array.from({ length: 10 }, (_item, index) => {
      const tag = playlist.skill_tags[index % Math.max(playlist.skill_tags.length, 1)] ?? playlist.category;
      return {
        question_text: `Which learning outcome best matches "${video.title}" in this ${playlist.category} playlist?`,
        options: [
          { id: 'a', text: `Understand and apply ${tag} concepts in a project` },
          { id: 'b', text: 'Memorize unrelated interview trivia only' },
          { id: 'c', text: 'Skip implementation practice entirely' },
          { id: 'd', text: 'Avoid documenting decisions and tradeoffs' },
        ],
        correct_option_id: 'a',
        explanation: `The goal is to turn ${tag} learning into usable project proof, not passive watching.`,
      };
    }),
  };
}

function sanitizeQuiz(raw: GeneratedQuiz, video: PlaylistVideoRow, playlist: PlaylistRow): GeneratedQuiz {
  const fallback = fallbackQuestions(video, playlist);
  const questions = raw.questions
    .filter((question) => question.question_text && question.options?.length >= 4)
    .slice(0, 10)
    .map((question) => {
      const options = question.options.slice(0, 4).map((option, index) => ({
        id: OPTION_IDS[index],
        text: String(option.text ?? '').trim() || fallback.questions[0].options[index].text,
      }));
      const correct = options.some((option) => option.id === question.correct_option_id)
        ? question.correct_option_id
        : 'a';
      return {
        question_text: String(question.question_text).trim(),
        options,
        correct_option_id: correct,
        explanation: String(question.explanation ?? 'Review the video and compare the core concept with the correct answer.'),
      };
    });

  return {
    questions: questions.length === 10 ? questions : fallback.questions,
  };
}

export async function generateQuestionsForVideo(video: PlaylistVideoRow, playlist: PlaylistRow): Promise<VideoQuestionRow[]> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('video_questions')
    .select('*')
    .eq('video_id', video.id)
    .order('position');

  if (existingError) throw new AppError(existingError.message, 500, 'QUIZ_LOOKUP_FAILED');
  if ((existing ?? []).length >= 10) {
    return existing as VideoQuestionRow[];
  }

  const system = 'You are an expert technical educator. Create clear applied questions that check whether a learner understood a software engineering lesson.';
  const prompt = `Generate exactly 10 quiz questions for a YouTube video titled "${video.title}" from playlist "${playlist.title}" about ${playlist.skill_tags.join(', ')}. Return ONLY valid JSON: { "questions": [{ "question_text": string, "options": [{ "id": "a"|"b"|"c"|"d", "text": string }], "correct_option_id": "a"|"b"|"c"|"d", "explanation": string }] }.`;
  const generated = await getClaudeJson<GeneratedQuiz>(system, prompt, fallbackQuestions(video, playlist));
  const quiz = sanitizeQuiz(generated, video, playlist);

  const rows = quiz.questions.map((question, index) => ({
    video_id: video.id,
    question_text: question.question_text,
    options: question.options,
    correct_option_id: question.correct_option_id,
    explanation: question.explanation,
    position: index + 1,
  }));

  const { data, error } = await supabaseAdmin
    .from('video_questions')
    .upsert(rows, { onConflict: 'video_id,position' })
    .select()
    .order('position');

  if (error) throw new AppError(error.message, 500, 'QUIZ_GENERATION_FAILED');
  return data as VideoQuestionRow[];
}
