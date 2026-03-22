import Anthropic from '@anthropic-ai/sdk';

let clientInstance: Anthropic | null = null;

/**
 * Returns a singleton Anthropic SDK client configured to use the Vite dev proxy.
 *
 * The SDK sends requests to `/api/anthropic` (baseURL). The Vite proxy rewrites
 * the path and injects the real API key server-side. The client bundle never
 * contains the real key.
 *
 * `dangerouslyAllowBrowser` is safe here because the real API key is NOT in
 * the client — it is proxy-handled.
 */
export function getAnthropicClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic({
      // API key is injected by the Vite proxy, so we pass a dummy value here.
      // The SDK requires apiKey to be set, but the proxy overwrites the header.
      apiKey: 'proxy-handled',
      baseURL: `${window.location.origin}/api/anthropic`,
      dangerouslyAllowBrowser: true,
    });
  }
  return clientInstance;
}

/**
 * Custom error wrapper for Anthropic API errors with retry classification.
 */
export class AnthropicError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AnthropicError';
    this.status = status;
  }

  /** Returns true for errors that may succeed on retry (rate limit, server error, overloaded). */
  get isRetryable(): boolean {
    return this.status === 429 || this.status === 500 || this.status === 529;
  }
}
