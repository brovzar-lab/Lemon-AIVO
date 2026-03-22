import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentId } from '@/types/agent';
import { useChatStore } from '@/store/chatStore';
import { useOfficeStore } from '@/store/officeStore';
import { sendStreamingMessage } from '@/services/anthropic/stream';
import { retryWithBackoff } from '@/services/anthropic/retryBackoff';
import { buildCrossVisibilityBlock } from '@/services/context/warRoomSummary';
import { useDealStore } from '@/store/dealStore';
import { extractAndStoreMemory } from '@/services/memory/extractMemory';
import { interruptIdleBehavior } from '@/engine/idleBehaviorManager';
import { useActivityStore } from '@/store/activityStore';
import { getAgent } from '@/config/agents';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];

/**
 * Orchestration hook for War Room parallel multi-agent streaming.
 *
 * Broadcasts a single user message to all 5 agents simultaneously,
 * manages 5 independent streams with per-agent error handling,
 * mirrors messages to individual agent conversations, and injects
 * cross-visibility context on follow-up rounds.
 */
export function useWarRoom() {
  const [isGathering] = useState(false);
  const activeStreamsRef = useRef(false);

  const warRoomStreaming = useChatStore((s) => s.warRoomStreaming);
  const warRoomRound = useChatStore((s) => s.warRoomRound);

  // Cleanup: cancel streams on unmount
  useEffect(() => {
    return () => {
      if (activeStreamsRef.current) {
        useChatStore.getState().cancelAllWarRoomStreams();
      }
    };
  }, []);

  /**
   * Broadcast a message to all 5 agents simultaneously.
   *
   * Flow:
   * 1. Get/create conversations for all 5 agents
   * 2. Add user message to all 5 conversations (MUST await before streams)
   * 3. Increment round and reset streaming state
   * 4. Fire 5 parallel streams via Promise.allSettled
   * 5. Save last responses for cross-visibility on next round
   */
  const sendBroadcast = useCallback(async (content: string) => {
    const store = useChatStore.getState();
    const currentRound = store.warRoomRound;

    // 1. Get or create conversations for all 5 agents
    const conversationIds: Record<string, string> = {};
    await Promise.all(
      AGENT_IDS.map(async (agentId) => {
        const convId = await store.getOrCreateConversation(agentId);
        conversationIds[agentId] = convId;
      }),
    );

    // 2. Add user message to ALL 5 conversations (must await before streams - Pitfall 3)
    await Promise.all(
      AGENT_IDS.map((agentId) =>
        store.addMessage(conversationIds[agentId]!, {
          conversationId: conversationIds[agentId]!,
          role: 'user',
          content,
          source: 'war-room',
        }),
      ),
    );

    // 3. Increment round and reset streaming state
    const newRound = currentRound + 1;
    store.setWarRoomMode(true, newRound);
    store.resetWarRoomStreaming();

    // Interrupt idle behaviors and mark all agents as 'thinking'
    const officeState = useOfficeStore.getState();
    for (const agentId of AGENT_IDS) {
      interruptIdleBehavior(agentId);
      officeState.setAgentStatus(agentId, 'thinking');
    }

    activeStreamsRef.current = true;

    // Log boardroom meeting to activity feed
    for (const agentId of AGENT_IDS) {
      const agentConfig = getAgent(agentId);
      if (agentConfig) {
        useActivityStore.getState().logActivity(agentConfig.name, 'joined the boardroom meeting');
      }
    }

    // 4. Build cross-visibility blocks for follow-up rounds (round > 1)
    const crossVisibilityBlocks: Record<string, string> = {};
    if (currentRound > 0) {
      const lastResponses = store.warRoomLastResponses;
      for (const agentId of AGENT_IDS) {
        crossVisibilityBlocks[agentId] = buildCrossVisibilityBlock(agentId, lastResponses);
      }
    }

    // 5. Fire 5 parallel streams via Promise.allSettled
    const streamPromises = AGENT_IDS.map((agentId) => {
      const abortController = new AbortController();
      store.startWarRoomStream(agentId, abortController);

      // Track accumulated content per agent (onToken delivers individual tokens)
      let accumulated = '';

      const convId = conversationIds[agentId]!;

      // Get conversation for context
      const conversation = useChatStore.getState().conversations[convId];
      const apiMessages = conversation
        ? conversation.messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: 'user' as const, content }];


      const executeStream = () =>
        sendStreamingMessage(
          agentId,
          apiMessages,
          {
            onToken: (token: string) => {
              accumulated += token;
              useChatStore.getState().updateWarRoomContent(agentId, accumulated);
            },
            onComplete: async (fullContent: string, _usage) => {
              useChatStore.getState().completeWarRoomStream(agentId);

              // Update agent status
              const offState = useOfficeStore.getState();
              offState.setAgentStatus(
                agentId,
                offState.activeRoomId === 'war-room' ? 'idle' : 'needs-attention',
              );

              // Mirror assistant response to agent's individual conversation
              await useChatStore.getState().addMessage(convId, {
                conversationId: convId,
                role: 'assistant',
                content: fullContent,
                source: 'war-room',
              });

              // Fire-and-forget memory extraction per agent
              const currentDealId = useDealStore.getState().activeDealId ?? 'default';
              void extractAndStoreMemory(agentId, content, fullContent, currentDealId);
            },
            onError: (error: Error) => {
              // Check if it's a 429 retryable error
              const is429 = 'status' in error && (error as Error & { status: number }).status === 429;

              if (is429) {
                // Update status to retrying
                useChatStore.getState().startWarRoomStream(agentId, abortController);
                throw error; // Will be caught by retryWithBackoff
              }

              // Non-retryable error
              useChatStore.getState().failWarRoomStream(agentId, error.message);
              useOfficeStore.getState().setAgentStatus(agentId, 'idle');
            },
          },
          abortController.signal,
          conversation,
        );

      // Wrap in retry for 429 errors
      return retryWithBackoff(executeStream, {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (_attempt, _delay) => {
          // Mark stream as retrying
          const s = useChatStore.getState();
          s.startWarRoomStream(agentId, abortController);
        },
      }).catch((err: Error) => {
        // If all retries exhausted or non-retryable error thrown from inside
        useChatStore.getState().failWarRoomStream(agentId, err.message);
        useOfficeStore.getState().setAgentStatus(agentId, 'idle');
      });
    });

    await Promise.allSettled(streamPromises);

    // 6. Save last responses for cross-visibility on next round
    useChatStore.getState().saveWarRoomLastResponses();
    activeStreamsRef.current = false;
  }, []);

  /**
   * Cancel all active War Room streams. Partial responses are preserved.
   */
  const cancelAll = useCallback(() => {
    useChatStore.getState().cancelAllWarRoomStreams();
    activeStreamsRef.current = false;

    // Reset agent statuses to idle
    const officeState = useOfficeStore.getState();
    for (const agentId of AGENT_IDS) {
      officeState.setAgentStatus(agentId, 'idle');
    }
  }, []);

  return {
    sendBroadcast,
    cancelAll,
    isGathering,
    warRoomStreaming,
    warRoomRound,
  };
}
