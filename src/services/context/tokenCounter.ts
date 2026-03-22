/**
 * Fast token estimation for context window management.
 *
 * Claude uses ~4 characters per token on average for English text.
 * This is a fast approximation; exact counting would require tiktoken
 * which adds significant bundle size.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Known context window sizes per model. */
export const TOKEN_LIMITS = {
  'claude-sonnet-4-20250514': 200_000, // 200K context window
} as const;

/** Default model used for chat completions. */
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/** Maximum output tokens per response. */
export const MAX_OUTPUT_TOKENS = 4096;

/**
 * When total conversation tokens exceed this fraction of the context window,
 * trigger auto-summarization to compress older messages.
 */
export const SUMMARIZE_THRESHOLD = 0.8; // 80% of context window
