import { GoogleGenerativeAI } from '@google/generative-ai';

let geminiAI: GoogleGenerativeAI | null = null;
const modelName = 'text-embedding-004';

/**
 * Initializes and returns a GoogleGenerativeAI client instance
 */
function getGeminiClient(): GoogleGenerativeAI {
  if (geminiAI) {
    return geminiAI;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  geminiAI = new GoogleGenerativeAI(apiKey);
  return geminiAI;
}

/**
 * Generates embeddings for a batch of texts using Google AI SDK
 * @param texts - Array of text inputs
 * @returns Promise resolving to an array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }], role: 'user' },
      })),
    });

    const embeddings = result.embeddings.map((e) => e.values);

    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings: SDK returned empty');
    }

    return embeddings;
  } catch (error) {
    throw new Error(
      `Gemini SDK error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}