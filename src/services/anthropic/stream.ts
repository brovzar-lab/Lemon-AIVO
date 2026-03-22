import type Anthropic from '@anthropic-ai/sdk';
import type { AgentId } from '@/types/agent';
import type { MessageRole } from '@/types/chat';
import { getAnthropicClient, AnthropicError } from './client';
import { buildContext } from '@/services/context/builder';
import type { Conversation } from '@/types/chat';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullContent: string, usage: { input_tokens: number; output_tokens: number }) => void;
  onError: (error: Error) => void;
  /** Called with the raw final message when stop_reason is 'tool_use'. */
  onToolUse?: (message: Anthropic.Message) => void;
}

/**
 * Sends a streaming message to the Anthropic API using the official SDK's
 * `.stream()` method. Tokens arrive incrementally via `callbacks.onToken`.
 *
 * Cancellation: pass an AbortSignal. On abort, `onComplete` is called with
 * whatever content has accumulated (partial response preserved).
 */
export async function sendStreamingMessage(
  agentId: AgentId,
  messages: Array<{ role: MessageRole; content: string }>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  conversation?: Conversation,
  tools?: Anthropic.Tool[],
): Promise<void> {
  try {
    const client = getAnthropicClient();

    // Build layered system prompt and formatted messages
    const context = buildContext(agentId, messages, conversation);

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: context.systemPrompt,
      messages: context.messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: { type: 'auto' } } : {}),
    });

    // Track accumulated content for abort case
    let accumulatedContent = '';

    // Wire up abort signal to cancel the stream
    if (signal) {
      const onAbort = () => {
        stream.abort();
      };
      signal.addEventListener('abort', onAbort, { once: true });

      // Clean up listener when stream ends
      stream.on('end', () => {
        signal.removeEventListener('abort', onAbort);
      });
    }

    // Deliver tokens incrementally
    stream.on('text', (textDelta) => {
      accumulatedContent += textDelta;
      callbacks.onToken(textDelta);
    });

    // Handle completion with usage stats
    stream.on('finalMessage', (message) => {
      if (message.stop_reason === 'tool_use' && callbacks.onToolUse) {
        callbacks.onToolUse(message);
        return;
      }

      const fullText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('');

      callbacks.onComplete(fullText, message.usage);
    });

    // Handle errors
    stream.on('error', (error) => {
      const apiError = toAnthropicError(error);
      callbacks.onError(apiError);
    });

    // Handle abort — preserve partial content
    stream.on('abort', () => {
      callbacks.onComplete(accumulatedContent, { input_tokens: 0, output_tokens: 0 });
    });

    // Wait for the stream to finish
    await stream.done();
  } catch (error: unknown) {
    // Handle errors that occur before or outside the stream events
    if (error instanceof DOMException && error.name === 'AbortError') {
      // User cancelled — silently complete (abort handler already fired)
      return;
    }

    const apiError = toAnthropicError(error);
    callbacks.onError(apiError);
  }
}

/**
 * Wraps an unknown error into an AnthropicError if it has a status code,
 * otherwise returns a generic Error with a user-friendly message.
 */
function toAnthropicError(error: unknown): Error {
  if (error instanceof AnthropicError) {
    return error;
  }

  // SDK errors have a `status` property
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    const message = (error as { message?: string }).message || 'Unknown API error';

    const anthropicError = new AnthropicError(status, message);

    if (anthropicError.isRetryable) {
      anthropicError.message = `${message}. Retry in a moment.`;
    }

    return anthropicError;
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('An unexpected error occurred while communicating with the AI service.');
}
