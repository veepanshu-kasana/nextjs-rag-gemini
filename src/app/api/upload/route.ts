import { NextRequest, NextResponse } from 'next/server';
import { parsePDF } from '@/lib/pdfParser';
import { chunkText } from '@/utils/textChunker';
import { generateEmbeddingsBatch } from '@/lib/gemini';
import { upsertVectors } from '@/lib/pinecone';

/**
 * API route handler for PDF upload and processing
 * Accepts PDF file, extracts text, chunks it, generates embeddings, and stores in Pinecone
 */
export async function POST(request: NextRequest) {
  try {
    // Get form data from request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, message: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const rawText = await parsePDF(buffer);

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'No text content found in PDF' },
        { status: 400 }
      );
    }

    // Split text into ~300 word chunks
    const textChunks = chunkText(rawText, 300);

    if (textChunks.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Failed to chunk text' },
        { status: 500 }
      );
    }

    const embeddings = await generateEmbeddingsBatch(textChunks);

    if (embeddings.length !== textChunks.length) {
      throw new Error('Embedding count does not match chunk count');
    }

    // Get Pinecone index name from environment (or use default)
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME environment variable is not set');
    }

    // Process each chunk: generate embedding and upsert to Pinecone
    const vectors = textChunks.map((chunk, index) => {
        const embedding = embeddings[index]; // Get the pre-generated embedding

        // Truncate text for metadata
        // Pinecone has metadata size limits (around 40kb per object)
        // Truncating to 1000 characters is a safe bet.
        const truncatedText = chunk.substring(0, 1000);

        return {
          id: `${file.name}-chunk-${index}`,
          values: embedding,
          metadata: {
            text: truncatedText,
            fileName: file.name,
            chunkIndex: index,
            totalChunks: textChunks.length,
          },
        };
    });

    // Upsert all vectors to Pinecone in batch
    await upsertVectors(indexName, vectors);

    return NextResponse.json({
      success: true,
      message: 'PDF processed and uploaded successfully',
      chunksProcessed: textChunks.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
