/**
 * Chat memory management for maintaining conversation history
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationHistory {
  sessionId: string;
  messages: Message[];
  createdAt: number;
  lastUpdated: number;
}

// In-memory storage for chat sessions
// In production, use Redis, database, or persistent storage
const chatSessions = new Map<string, ConversationHistory>();

// Configuration
const MAX_MESSAGES_PER_SESSION = 20; // Keep last 20 messages
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize or get a chat session
 * @param sessionId - Unique session identifier
 * @returns Conversation history
 */
export function getSession(sessionId: string): ConversationHistory {
  const existing = chatSessions.get(sessionId);
  
  if (existing) {
    // Check if session has expired
    const now = Date.now();
    if (now - existing.lastUpdated > SESSION_TIMEOUT) {
      // Session expired, create new one
      const newSession: ConversationHistory = {
        sessionId,
        messages: [],
        createdAt: now,
        lastUpdated: now,
      };
      chatSessions.set(sessionId, newSession);
      return newSession;
    }
    return existing;
  }

  // Create new session
  const newSession: ConversationHistory = {
    sessionId,
    messages: [],
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
  chatSessions.set(sessionId, newSession);
  return newSession;
}

/**
 * Add a message to the conversation history
 * @param sessionId - Session identifier
 * @param role - Message role (user or assistant)
 * @param content - Message content
 */
export function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  const session = getSession(sessionId);
  
  session.messages.push({
    role,
    content,
    timestamp: Date.now(),
  });

  // Trim to max messages (keep recent conversations)
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
  }

  session.lastUpdated = Date.now();
  chatSessions.set(sessionId, session);
}

/**
 * Get conversation history for context
 * @param sessionId - Session identifier
 * @param lastN - Number of recent messages to retrieve (default: 10)
 * @returns Array of recent messages
 */
export function getConversationHistory(
  sessionId: string,
  lastN: number = 10
): Message[] {
  const session = getSession(sessionId);
  return session.messages.slice(-lastN);
}

/**
 * Format conversation history as a string for LLM context
 * @param sessionId - Session identifier
 * @param lastN - Number of recent messages to include
 * @returns Formatted conversation history
 */
export function formatHistoryForPrompt(
  sessionId: string,
  lastN: number = 10
): string {
  const history = getConversationHistory(sessionId, lastN);
  
  if (history.length === 0) {
    return 'No previous conversation.';
  }

  return history
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
}

/**
 * Clear a session's history
 * @param sessionId - Session identifier
 */
export function clearSession(sessionId: string): void {
  chatSessions.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of chatSessions.entries()) {
    if (now - session.lastUpdated > SESSION_TIMEOUT) {
      chatSessions.delete(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

