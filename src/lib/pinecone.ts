import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

/**
 * Initializes and returns Pinecone client instance
 * Uses environment variables: PINECONE_API_KEY
 * @returns Pinecone client instance
 * @throws Error if API key is missing
 */
export function getPineconeClient(): Pinecone {
  if (pineconeClient) {
    return pineconeClient;
  }

  const apiKey = process.env.PINECONE_API_KEY;
  
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }

  pineconeClient = new Pinecone({
    apiKey: apiKey,
  });

  return pineconeClient;
}

/**
 * Upserts vectors into a Pinecone index
 * @param indexName - Name of the Pinecone index
 * @param vectors - Array of vectors to upsert with id, values, and metadata
 * @returns Promise resolving when upsert completes
 * @throws Error if upsert fails
 */
export async function upsertVectors(
  indexName: string,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, string | number | boolean>;
  }>
): Promise<void> {
  try {
    const pinecone = getPineconeClient();
    const index = pinecone.index(indexName);
    
    await index.upsert(vectors);
  } catch (error) {
    throw new Error(
      `Failed to upsert vectors to Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Queries Pinecone index for similar vectors
 * @param indexName - Name of the Pinecone index
 * @param queryVector - The embedding vector to search with
 * @param topK - Number of top results to return
 * @returns Promise resolving to array of matches with metadata
 * @throws Error if query fails
 */
export async function queryVectors(
  indexName: string,
  queryVector: number[],
  topK: number = 5
): Promise<Array<{
  id: string;
  score: number;
  metadata: RecordMetadata;
}>> {
  try {
    const pinecone = getPineconeClient();
    const index = pinecone.index(indexName);
    
    const queryResponse = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });

    return queryResponse.matches.map((match) => ({
      id: match.id,
      score: match.score ?? 0,
      metadata: match.metadata ?? {},
    }));
  } catch (error) {
    throw new Error(
      `Failed to query Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

