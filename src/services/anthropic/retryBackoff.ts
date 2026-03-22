export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Callback invoked before each retry with attempt number and delay */
  onRetry?: (attempt: number, delayMs: number) => void;
}

/**
 * Retry a function with exponential backoff and jitter.
 * Designed for handling 429 rate limit errors from the Anthropic API.
 *
 * Delay formula: 2^attempt * baseDelayMs + random(0-500ms)
 * - Attempt 0: ~1000-1500ms
 * - Attempt 1: ~2000-2500ms
 * - Attempt 2: ~4000-4500ms
 *
 * @param fn - Async function to execute and potentially retry
 * @param options - Retry configuration
 * @returns The result of the successful function call
 * @throws The last error if all retries are exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;

      const delay = Math.pow(2, attempt) * baseDelayMs + Math.random() * 500;
      onRetry?.(attempt + 1, delay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Unreachable -- the loop either returns or throws
  throw new Error('Unreachable');
}
