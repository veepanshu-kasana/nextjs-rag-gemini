import { generateWithTools } from './gemini';
import { tools, executeTool } from './tools';
import { addMessage, formatHistoryForPrompt } from './memory';

/**
 * Processes a user query using RAG with function calling and conversation memory
 * @param query - User's question
 * @param indexName - Pinecone index name to query
 * @param sessionId - Session ID for conversation history (default: 'default')
 * @returns AI-generated answer, potentially using tools
 * @throws Error if any step fails
 */
export async function processQuery(
  query: string,
  indexName: string,
  sessionId: string = 'default'
): Promise<string> {
  const maxIterations = 5; // Prevent infinite loops
  let iteration = 0;
  
  // Save user message to history
  addMessage(sessionId, 'user', query);
  
  // Build initial prompt with conversation history
  let currentPrompt = buildSystemPrompt(query, sessionId);

  while (iteration < maxIterations) {
    iteration++;

    // Call Gemini with tools
    const response = await generateWithTools(currentPrompt, tools);

    // Check if model wants to use a function
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      // No function calls - model generated final answer
      const finalAnswer = response.text();
      
      if (!finalAnswer) {
        throw new Error('Model returned empty response');
      }
      
      // Save assistant response to history
      addMessage(sessionId, 'assistant', finalAnswer);
      
      return finalAnswer;
    }

    // Execute all function calls
    const toolResults = await Promise.all(
      functionCalls.map((fc) =>
        executeTool(
          {
            name: fc.name,
            args: fc.args as Record<string, string | number | boolean>,
          },
          indexName
        )
      )
    );

    // Build next prompt with tool results
    currentPrompt = buildFollowUpPrompt(query, toolResults);
  }

  // Fallback if we hit max iterations
  const fallbackMessage = 'I apologize, but I encountered an issue processing your request. Please try rephrasing your question.';
  addMessage(sessionId, 'assistant', fallbackMessage);
  return fallbackMessage;
}

/**
 * Builds the initial system prompt for the AI with conversation history
 * @param query - User's question
 * @param sessionId - Session ID for retrieving history
 * @returns Formatted prompt
 */
function buildSystemPrompt(query: string, sessionId: string): string {
  const conversationHistory = formatHistoryForPrompt(sessionId, 8);
  
  return `You are a helpful, intelligent AI assistant with access to a knowledge base of uploaded PDF documents. Your goal is to provide accurate, natural, and helpful responses.

IMPORTANT GUIDELINES:
1. NEVER expose internal implementation details (index names, tool names, function names, technical details)
2. NEVER mention tools, functions, or backend systems in your responses
3. When searching documents, use the 'search_knowledge_base' tool to find information
4. When asked about available documents, use 'get_document_stats' to get real information, then summarize it naturally
5. Provide clear, conversational answers as if you directly know the information
6. Always cite sources by mentioning the document name AND page number when using information from PDFs (e.g., "According to document.pdf page 5...")
7. If you don't have enough information, politely say so without revealing technical details
8. Remember conversation context and provide coherent follow-up responses

RESPONSE STYLE:
- Be conversational and natural
- Focus on helping the user
- Never say "I used a tool" or "I searched the database"
- Present information as if it's your knowledge
- Be concise but informative

CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER QUESTION:
${query}

Provide a helpful, natural response without exposing any technical implementation details.`;
}

/**
 * Builds a follow-up prompt with tool results
 * @param query - Original user question
 * @param toolResults - Results from tool executions
 * @returns Formatted prompt with tool results
 */
function buildFollowUpPrompt(
  query: string,
  toolResults: Array<{ toolName: string; result: string }>
): string {
  const resultsText = toolResults
    .map((tr) => tr.result)
    .join('\n\n---\n\n');

  return `Based on the information below, provide a natural, helpful answer to the user's question.

ORIGINAL QUESTION:
${query}

RETRIEVED INFORMATION:
${resultsText}

INSTRUCTIONS:
- Provide a clear, conversational answer using the information above
- NEVER mention "tools", "functions", "database", "index", or any technical terms
- Present the information as if it's your direct knowledge
- Cite document names AND page numbers naturally when referencing specific information (e.g., "According to document.pdf page 3...")
- If information is insufficient, say so politely without technical details
- Be helpful, accurate, and conversational

Your natural response:`;
}
