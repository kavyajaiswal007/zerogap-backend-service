import { anthropic } from '../config/anthropic.js';
import { openai } from '../config/openai.js';

const AI_JSON_TIMEOUT_MS = 12_000;

function rejectAfter(ms: number) {
  return new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('AI response timed out')), ms);
  });
}

export async function getClaudeText(system: string, prompt: string, maxTokens = 1800) {
  if (anthropic) {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_output_tokens: maxTokens,
  });

  return response.output_text;
}

export async function getClaudeJson<T>(system: string, prompt: string, fallback: T): Promise<T> {
  try {
    const text = await Promise.race([
      getClaudeText(system, `${prompt}\n\nReturn valid JSON only.`),
      rejectAfter(AI_JSON_TIMEOUT_MS),
    ]);
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
