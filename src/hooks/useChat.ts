import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { AgentId } from '@/types/agent';
import { useChatStore } from '@/store/chatStore';
import { useDealStore } from '@/store/dealStore';
import { useFileStore } from '@/store/fileStore';
import { useOfficeStore } from '@/store/officeStore';
import { sendStreamingMessage } from '@/services/anthropic/stream';
import { buildContext } from '@/services/context/builder';
import { summarizeConversation } from '@/services/context/summarizer';
import { extractAndStoreMemory } from '@/services/memory/extractMemory';
import { parseDealAction } from '@/services/actions/parseDealAction';
import { SUMMARIZE_THRESHOLD, TOKEN_LIMITS, DEFAULT_MODEL } from '@/services/context/tokenCounter';
import { interruptIdleBehavior } from '@/engine/idleBehaviorManager';
import { CONSULTATION_TOOL, extractConsultationRequest, runCollaborationChain } from '@/services/collaboration/chainRunner';
import { useCollaborationStore } from '@/store/collaborationStore';
import { useActivityStore } from '@/store/activityStore';
import { getAgent } from '@/config/agents';

/**
 * Orchestration hook that wires store, API streaming, and context management.
 *
 * Returns everything the ChatPanel needs: messages, streaming state,
 * error state, and action handlers (send, cancel, retry, clearError).
 */
export function useChat(agentId: AgentId = 'patrik') {
  const initializedRef = useRef(false);
  const prevKeyRef = useRef<string>('');

  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const streaming = useChatStore((s) => s.streaming);
  const storeError = useChatStore((s) => s.error);
  const activeDealId = useDealStore((s) => s.activeDealId);

  // Initialize on mount and re-initialize when agentId or activeDealId changes.
  // loadConversations is already called once in App.tsx on mount.
  useEffect(() => {
    const key = `${agentId}:${activeDealId}`;
    if (prevKeyRef.current !== key) {
      // Reset initialized flag when agent or deal changes
      initializedRef.current = false;
      prevKeyRef.current = key;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    void useChatStore.getState().getOrCreateConversation(agentId);
  }, [agentId, activeDealId]);

  // Derive active conversation
  const conversation = activeConversationId
    ? conversations[activeConversationId] ?? null
    : null;

  const messages = conversation?.messages ?? [];
  const isStreaming = streaming.isStreaming;
  const tokenCount = conversation?.totalTokens ?? 0;
  const error = storeError;

  /**
   * Send a user message and stream Patrik's response.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      const store = useChatStore.getState();
      const convId = store.activeConversationId;
      if (!convId) return;

      // 1. Clear any existing error
      store.setError(null);

      // 2. Add user message to store
      await store.addMessage(convId, {
        conversationId: convId,
        role: 'user',
        content,
      });

      // 3. Get current conversation from store (with the new user message)
      const currentConversation = useChatStore.getState().conversations[convId];
      if (!currentConversation) return;

      // 4. Create AbortController and start streaming
      const abortController = new AbortController();
      store.startStreaming(abortController);

      // Interrupt idle behavior before marking agent as 'thinking'
      interruptIdleBehavior(agentId);
      // Mark agent as 'thinking' on canvas
      useOfficeStore.getState().setAgentStatus(agentId, 'thinking');

      // 5. Build messages array for the API
      const apiMessages = currentConversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Track accumulated content for streaming display
      let accumulated = '';

      await sendStreamingMessage(
        agentId,
        apiMessages,
        {
          onToken: (token: string) => {
            accumulated += token;
            useChatStore.getState().updateStreamingContent(accumulated);
          },
          onToolUse: async (message) => {
            const request = extractConsultationRequest(message);
            if (!request) return;

            // Save whatever the agent streamed before deciding to consult,
            // or a brief note if they went straight to tool_use with no text.
            const spokenText = accumulated.trim();
            if (spokenText) {
              await useChatStore.getState().addMessage(convId, {
                conversationId: convId,
                role: 'assistant',
                content: spokenText,
              });
            }

            useChatStore.getState().stopStreaming();
            useOfficeStore.getState().setAgentStatus(agentId, 'idle');

            const dealName = `Collaboration: ${agentId} — ${new Date().toLocaleDateString()}`;
            void useCollaborationStore.getState().startChain(agentId, content, dealName).then((chain) => {
              void runCollaborationChain(chain, {
                targetAgentId: request.targetAgentId,
                reason: request.reason,
                estimatedTokens: request.estimatedTokens,
              });
            });
          },
          onComplete: async (fullContent: string, _usage) => {
            const s = useChatStore.getState();
            s.stopStreaming();

            // Update agent status: 'idle' if user is in the room, 'needs-attention' otherwise
            const officeState = useOfficeStore.getState();
            officeState.setAgentStatus(
              agentId,
              officeState.activeRoomId === agentId ? 'idle' : 'needs-attention',
            );

            // Add assistant message
            await s.addMessage(convId, {
              conversationId: convId,
              role: 'assistant',
              content: fullContent,
            });

            // Log to activity feed
            const agentConfig = getAgent(agentId);
            if (agentConfig) {
              useActivityStore.getState().logActivity(agentConfig.name, 'responded to Billy');
            }

            // Handle deal creation action if agent emitted the sentinel
            const dealAction = parseDealAction(fullContent);
            if (dealAction) {
              const dealStore = useDealStore.getState();
              const fileStore = useFileStore.getState();
              const oldDealId = dealStore.activeDealId;

              // Create the new deal
              const newDealId = await dealStore.createDeal(dealAction.name, dealAction.description);

              // Migrate the current conversation to the new deal BEFORE switching,
              // so loadConversations (triggered by switchDeal) finds it and the
              // chat history is preserved.
              const { getPersistence } = await import('@/services/persistence/adapter');
              const persistence = getPersistence();
              const currentConv = useChatStore.getState().conversations[convId];
              if (currentConv) {
                const updatedConv = { ...currentConv, dealId: newDealId, messages: [] };
                await persistence.set('conversations', convId, updatedConv);
              }

              // Move current agent's files from old deal to new deal
              if (oldDealId) {
                const fileIds = fileStore.files
                  .filter((f) => f.agentId === agentId && f.dealId === oldDealId)
                  .map((f) => f.id);
                if (fileIds.length > 0) {
                  await fileStore.reassignFilesToDeal(fileIds, newDealId);
                }
              }

              // Switch to the new deal — loadConversations will now find the migrated conversation
              await dealStore.switchDeal(newDealId);
            }

            // Fire-and-forget memory extraction (non-blocking, non-fatal)
            const currentDealId = useDealStore.getState().activeDealId ?? 'default';
            void extractAndStoreMemory(agentId, content, fullContent, currentDealId);

            // Update token count from context builder
            const updatedConversation = useChatStore.getState().conversations[convId];
            if (updatedConversation) {
              const ctx = buildContext(
                agentId,
                updatedConversation.messages.map((m) => ({ role: m.role, content: m.content })),
                updatedConversation,
              );
              s.updateConversationTokens(convId, ctx.totalTokens);

              // Check if summarization is needed
              const limit = TOKEN_LIMITS[DEFAULT_MODEL];
              const latestConv = useChatStore.getState().conversations[convId];
              if (latestConv && latestConv.totalTokens > SUMMARIZE_THRESHOLD * limit) {
                await summarizeConversation(latestConv, {
                  onComplete: (summary, summaryTokens) => {
                    useChatStore.getState().setConversationSummary(convId, summary, summaryTokens);
                  },
                  onError: (err) => {
                    // Summarization failure is non-fatal; log and continue
                    console.warn('Auto-summarization failed:', err.message);
                  },
                });
              }
            }
          },
          onError: (err: Error) => {
            useChatStore.getState().stopStreaming();
            // Error means no unread content, set back to idle
            useOfficeStore.getState().setAgentStatus(agentId, 'idle');
            useChatStore.getState().setError(
              err.message || 'An unexpected error occurred. Please try again.',
            );
          },
        },
        abortController.signal,
        currentConversation,
        [CONSULTATION_TOOL],
      );
    },
    [agentId],
  );

  /**
   * Cancel the currently streaming response. Partial content is preserved.
   */
  const cancelStream = useCallback(() => {
    const store = useChatStore.getState();
    store.streaming.abortController?.abort();
    store.stopStreaming();
  }, []);

  /**
   * Retry the last exchange: remove the failed assistant message (if any)
   * and re-send the most recent user message.
   */
  const retryLastMessage = useCallback(async () => {
    const store = useChatStore.getState();
    const convId = store.activeConversationId;
    if (!convId) return;

    const conv = store.conversations[convId];
    if (!conv || conv.messages.length === 0) return;

    // Find the last user message
    let lastUserContent: string | null = null;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      const msg = conv.messages[i];
      if (msg && msg.role === 'user') {
        lastUserContent = msg.content;
        break;
      }
    }

    if (!lastUserContent) return;

    // Clear the error
    store.setError(null);

    // Re-send the message
    await sendMessage(lastUserContent);
  }, [sendMessage]);

  /**
   * Clear the current error without retrying.
   */
  const clearError = useCallback(() => {
    useChatStore.getState().setError(null);
  }, []);

  return useMemo(
    () => ({
      messages,
      isStreaming,
      error,
      tokenCount,
      streamingContent: streaming.currentContent,
      conversation,
      sendMessage,
      cancelStream,
      retryLastMessage,
      clearError,
    }),
    [messages, isStreaming, error, tokenCount, streaming.currentContent, conversation, sendMessage, cancelStream, retryLastMessage, clearError],
  );
}
