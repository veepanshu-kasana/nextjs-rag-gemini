import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';

let geminiAI: GoogleGenerativeAI | null = null;
const embeddingModelName = 'text-embedding-004';
const chatModelName = 'gemini-2.5-flash';

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
    const model = genAI.getGenerativeModel({ model: embeddingModelName });

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

/**
 * Generates a text response using Gemini chat model
 * @param prompt - The prompt to send to the model
 * @returns Promise resolving to the generated text
 */
export async function generateText(prompt: string): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: chatModelName });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Failed to generate text: Model returned empty response');
    }

    return text;
  } catch (error) {
    throw new Error(
      `Gemini generation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generates content with function calling support
 * @param prompt - User's message/query
 * @param tools - Available tools for the model to use
 * @returns Generated response with potential function calls
 */
export async function generateWithTools(
  prompt: string,
  tools: FunctionDeclaration[]
) {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: chatModelName,
      tools: [{ functionDeclarations: tools }],
    });

    const result = await model.generateContent(prompt);
    return result.response;
  } catch (error) {
    throw new Error(
      `Gemini tool calling error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}