import { queryVectors } from './pinecone';
import { generateEmbeddingsBatch } from './gemini';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

/**
 * Result from a tool execution
 */
export interface ToolResult {
  toolName: string;
  result: string;
}

/**
 * Tool call from Gemini
 */
export interface ToolCall {
  name: string;
  args: Record<string, string | number | boolean>;
}

/**
 * Available tools for the RAG chatbot
 */
export const tools: FunctionDeclaration[] = [
  {
    name: 'search_knowledge_base',
    description: 'Searches the uploaded PDF documents for information relevant to a query. Use this when the user asks questions about the documents content.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'The search query to find relevant information in the documents',
        }
      },
      required: ['query'],
    },
  },
  {
    name: 'get_document_stats',
    description: 'Gets statistics about the uploaded documents including total number of documents and chunks. Use this when the user asks about what documents they have uploaded or wants to know what is available in the knowledge base.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
];

/**
 * Executes a tool call from Gemini
 * @param toolCall - The tool call with name and arguments
 * @param indexName - Pinecone index name
 * @returns Tool execution result
 */
export async function executeTool(
  toolCall: ToolCall,
  indexName: string
): Promise<ToolResult> {
  const { name, args } = toolCall;

  switch (name) {
    case 'search_knowledge_base':
      return await searchKnowledgeBase(args, indexName);

    case 'get_document_stats':
      return await getDocumentStats(indexName);

    default:
      return {
        toolName: name,
        result: `Unknown tool: ${name}`,
      };
  }
}

/**
 * Searches the knowledge base for relevant information
 */
async function searchKnowledgeBase(
  args: Record<string, string | number | boolean>,
  indexName: string
): Promise<ToolResult> {
  try {
    const query = String(args.query ?? '');
    const topK = typeof args.topK === 'number' ? Math.min(args.topK, 10) : 5;

    if (!query) {
      return {
        toolName: 'search_knowledge_base',
        result: 'Error: Query parameter is required',
      };
    }

    // Generate embedding for the query
    const embeddings = await generateEmbeddingsBatch([query]);
    const queryEmbedding = embeddings[0];

    if (!queryEmbedding) {
      return {
        toolName: 'search_knowledge_base',
        result: 'Error: Failed to generate query embedding',
      };
    }

    // Query Pinecone
    const matches = await queryVectors(indexName, queryEmbedding, topK);

    if (matches.length === 0) {
      return {
        toolName: 'search_knowledge_base',
        result: 'No relevant information found in the uploaded documents.',
      };
    }

    // Format results with page numbers
    const formattedResults = matches
      .map((match, index) => {
        const text = String(match.metadata.text ?? 'No content');
        const fileName = String(match.metadata.fileName ?? 'Unknown');
        const pageNumber = match.metadata.pageNumber ?? 'N/A';
        const score = (match.score * 100).toFixed(2);

        return `[Result ${index + 1} - Source: ${fileName}, Page ${pageNumber}, Relevance: ${score}%]\n${text}`;
      })
      .join('\n\n---\n\n');

    return {
      toolName: 'search_knowledge_base',
      result: `Found ${matches.length} relevant chunks:\n\n${formattedResults}`,
    };
  } catch (error) {
    return {
      toolName: 'search_knowledge_base',
      result: `Error searching knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Gets statistics about available documents
 */
async function getDocumentStats(indexName: string): Promise<ToolResult> {
  try {
    const { getPineconeClient } = await import('./pinecone');
    const pinecone = getPineconeClient();
    const index = pinecone.index(indexName);
    
    const stats = await index.describeIndexStats();
    
    const totalRecords = stats.totalRecordCount ?? 0;
    const namespaces = stats.namespaces ? Object.keys(stats.namespaces) : [];
    
    if (totalRecords === 0) {
      return {
        toolName: 'get_document_stats',
        result: 'No documents have been uploaded yet. Please upload some PDF documents first to start asking questions.',
      };
    }
    
    // Extract unique file names from record IDs if available
    let fileInfo = '';
    if (namespaces.length > 0) {
      fileInfo = `You have uploaded documents with a total of ${totalRecords} text chunks stored in the knowledge base.`;
    } else {
      fileInfo = `You have ${totalRecords} document chunks stored in the knowledge base, ready for search.`;
    }
    
    return {
      toolName: 'get_document_stats',
      result: fileInfo,
    };
  } catch (error) {
    return {
      toolName: 'get_document_stats',
      result: `Unable to retrieve document information at this time. ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

