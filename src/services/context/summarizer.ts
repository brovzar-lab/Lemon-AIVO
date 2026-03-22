import type { Conversation, Message } from '@/types/chat';
import { getAnthropicClient } from '@/services/anthropic/client';
import { getPersistence } from '@/services/persistence/adapter';
import { estimateTokens, TOKEN_LIMITS, DEFAULT_MODEL, SUMMARIZE_THRESHOLD } from './tokenCounter';

/** Number of recent messages to keep verbatim (not included in summarization). */
const KEEP_RECENT_MESSAGES = 10;

const SUMMARIZATION_PROMPT = `Summarize this conversation into structured key facts. Preserve:
- All dollar amounts with currency (MXN, USD, EUR)
- All dates and deadlines
- All decisions made
- All action items and next steps
- All names and entities mentioned
- All financial metrics (IRR, MOIC, hurdle rates, etc.)
- Key assumptions and constraints discussed

Format as a structured list grouped by topic.`;

/**
 * Checks whether a conversation needs summarization and, if so, compresses
 * older messages into a structured summary while preserving recent messages.
 *
 * The full uncompressed history is stored in IndexedDB before replacement
 * so no data is permanently lost.
 */
export async function summarizeConversation(
  conversation: Conversation,
  callbacks: {
    onComplete: (summary: string, summaryTokens: number) => void;
    onError: (error: Error) => void;
  },
): Promise<void> {
  const limit = TOKEN_LIMITS[DEFAULT_MODEL];

  // Check if summarization is needed
  if (conversation.totalTokens < SUMMARIZE_THRESHOLD * limit) {
    return;
  }

  // Determine which messages to summarize vs keep
  const allMessages = conversation.messages;
  const keepCount = Math.min(KEEP_RECENT_MESSAGES, allMessages.length);
  const messagesToSummarize = allMessages.slice(0, allMessages.length - keepCount);

  // Nothing to summarize if all messages are "recent"
  if (messagesToSummarize.length === 0) {
    return;
  }

  try {
    // Store full uncompressed history in IndexedDB before summarizing
    const persistence = getPersistence();
    await persistence.set('conversations', `${conversation.id}-full`, {
      ...conversation,
      id: `${conversation.id}-full`,
    });

    // Build the conversation text for summarization
    const conversationText = messagesToSummarize
      .map((msg: Message) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Include any existing summary as additional context
    const existingSummaryContext = conversation.summary
      ? `Previous summary:\n${conversation.summary}\n\nNew messages to incorporate:\n`
      : '';

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system: SUMMARIZATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${existingSummaryContext}${conversationText}`,
        },
      ],
    });

    // Extract summary text from response
    const summaryText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('');

    const summaryTokens = estimateTokens(summaryText);

    callbacks.onComplete(summaryText, summaryTokens);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to summarize conversation';
    callbacks.onError(new Error(message));
  }
}

/**
 * Returns true if the conversation is approaching the context window limit
 * and would benefit from summarization.
 */
export function needsSummarization(conversation: Conversation): boolean {
  const limit = TOKEN_LIMITS[DEFAULT_MODEL];
  return conversation.totalTokens >= SUMMARIZE_THRESHOLD * limit;
}
