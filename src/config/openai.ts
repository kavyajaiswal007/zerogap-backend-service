import OpenAI from 'openai';
import { env } from './env.js';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const mentorOpenAI = new OpenAI({
  apiKey: env.MENTOR_OPENAI_API_KEY ?? env.OPENAI_API_KEY,
});
