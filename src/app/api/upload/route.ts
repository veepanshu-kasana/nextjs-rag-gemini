import { NextRequest, NextResponse } from 'next/server';
import { parsePDFWithPages } from '@/lib/pdfParser';
import { chunkTextWithPages } from '@/utils/textChunker';
import { generateEmbeddingsBatch } from '@/lib/gemini';
import { upsertVectors } from '@/lib/pinecone';

/**
 * API route handler for PDF upload and processing
 * Accepts PDF file, extracts text with page numbers, chunks it, generates embeddings, and stores in Pinecone
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

    // Extract text from PDF with page numbers
    const pages = await parsePDFWithPages(buffer);

    if (pages.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No text content found in PDF' },
        { status: 400 }
      );
    }

    // Split text into ~300 word chunks while preserving page numbers
    // If page 1 has 5 chunks, all 5 chunks will have pageNumber: 1
    const chunks = chunkTextWithPages(pages, 300);

    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Failed to chunk text' },
        { status: 500 }
      );
    }

    // Extract just the text for embedding generation
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await generateEmbeddingsBatch(chunkTexts);

    if (embeddings.length !== chunks.length) {
      throw new Error('Embedding count does not match chunk count');
    }

    // Get Pinecone index name from environment
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME environment variable is not set');
    }

    // Process each chunk with page number metadata
    const vectors = chunks.map((chunk, index) => {
        const embedding = embeddings[index];

        // Truncate text for metadata (Pinecone limit: ~40KB per object)
        const truncatedText = chunk.text.substring(0, 1000);

        return {
          id: `${file.name}-chunk-${index}`,
          values: embedding,
          metadata: {
            text: truncatedText,
            fileName: file.name,
            pageNumber: chunk.pageNumber, // Page number tracking
            chunkIndex: index,
            totalChunks: chunks.length,
            totalPages: pages.length,
          },
        };
    });

    // Upsert all vectors to Pinecone in batch
    await upsertVectors(indexName, vectors);

    return NextResponse.json({
      success: true,
      message: 'PDF processed and uploaded successfully',
      chunksProcessed: chunks.length,
      pagesProcessed: pages.length,
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
