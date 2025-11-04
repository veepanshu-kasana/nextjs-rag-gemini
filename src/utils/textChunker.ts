/**
 * Splits large text into chunks of approximately 300 words each.
 * Attempts to preserve sentence boundaries.
 * @param text - The text to chunk
 * @param targetWordsPerChunk - Target number of words per chunk (default: 300)
 * @returns Array of text chunks
 */
export function chunkText(text: string, targetWordsPerChunk: number = 300): string[] {
  const chunks: string[] = [];
  
  // 1. A more robust way to split into sentences
  // This regex finds all sequences of text ending in a punctuation mark (or end of string).
  const sentences = (text.match(/[^.!?]+[.!?]?/g) || [])
    .map((s) => s.trim()) // Clean up leading/trailing whitespace
    .filter((s) => s.length > 0); // Remove any empty strings

  // 2. Handle the "no sentences found" case with the simple word-based fallback
  if (sentences.length === 0) {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    for (let i = 0; i < words.length; i += targetWordsPerChunk) {
      const chunk = words.slice(i, i + targetWordsPerChunk).join(' ');
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  let currentChunk = '';
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter((w) => w.length > 0).length;

    // 3. Improved chunking logic
    // If adding this sentence would exceed the target AND the current chunk is not empty,
    // push the current chunk and start a new one.
    if (currentWordCount + wordCount > targetWordsPerChunk && currentWordCount > 0) {
      chunks.push(currentChunk);
      currentChunk = sentence; // Start new chunk with the current sentence
      currentWordCount = wordCount;
    } else {
      // Otherwise, add the sentence to the current chunk
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentWordCount += wordCount;
    }
  }

  // 4. Add the last remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}