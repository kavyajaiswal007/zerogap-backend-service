import { anthropic } from '../config/anthropic.js';
import { openai } from '../config/openai.js';

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
    const text = await getClaudeText(system, `${prompt}\n\nReturn valid JSON only.`);
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
