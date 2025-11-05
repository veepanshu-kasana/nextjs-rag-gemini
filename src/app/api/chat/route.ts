import { NextRequest, NextResponse } from 'next/server';
import { processQuery } from '@/lib/chat';

interface ChatRequest {
  query: string;
  sessionId?: string;
}

/**
 * API route handler for RAG-based chat queries
 * Retrieves relevant context from vector DB and generates AI responses
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json() as ChatRequest;
    const { query, sessionId = 'default' } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Get Pinecone index name from environment
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME environment variable is not set');
    }

    // Process query using RAG with conversation memory
    const answer = await processQuery(query, indexName, sessionId);

    return NextResponse.json({
      success: true,
      answer,
      sessionId,
    });
  } catch (error) {
    console.error('Chat query error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

