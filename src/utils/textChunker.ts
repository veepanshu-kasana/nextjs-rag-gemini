export interface TextChunk {
  text: string;
  pageNumber: number;
}

/**
 * Splits large text into chunks of approximately 300 words each.
 * Attempts to preserve sentence boundaries.
 * @param text - The text to chunk
 * @param targetWordsPerChunk - Target number of words per chunk (default: 300)
 * @returns Array of text chunks
 */
export function chunkText(text: string, targetWordsPerChunk: number = 300): string[] {
  const chunks: string[] = [];
  
  const sentences = (text.match(/[^.!?]+[.!?]?/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

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

    if (currentWordCount + wordCount > targetWordsPerChunk && currentWordCount > 0) {
      chunks.push(currentChunk);
      currentChunk = sentence;
      currentWordCount = wordCount;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentWordCount += wordCount;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Chunks text from pages while preserving page numbers.
 * If page 1 creates 5 chunks, all 5 will have pageNumber: 1
 * @param pages - Array of page texts with page numbers
 * @param targetWordsPerChunk - Target words per chunk
 * @returns Array of chunks with page numbers
 */
export function chunkTextWithPages(
  pages: Array<{ pageNumber: number; text: string }>,
  targetWordsPerChunk: number = 300
): TextChunk[] {
  const allChunks: TextChunk[] = [];

  for (const page of pages) {
    const pageChunks = chunkText(page.text, targetWordsPerChunk);
    
    // All chunks from this page get the same page number
    for (const chunkText of pageChunks) {
      allChunks.push({
        text: chunkText,
        pageNumber: page.pageNumber,
      });
    }
  }

  return allChunks;
}