import { openai } from '../config/openai.js';

export async function createEmbedding(input: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input,
  });

  return response.data[0]?.embedding ?? [];
}
