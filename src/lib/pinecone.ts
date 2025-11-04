import { Pinecone } from '@pinecone-database/pinecone';

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

