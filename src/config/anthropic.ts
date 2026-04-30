import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.js';

const apiKey = env.ANTHROPIC_API_KEY?.trim();

export const anthropic: Anthropic | null = apiKey
  ? new Anthropic({ apiKey })
  : null;
