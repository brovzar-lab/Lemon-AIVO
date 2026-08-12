/**
 * chainRunner — Collaboration hop orchestration service.
 *
 * Orchestrates the full hop sequence for a collaboration chain:
 * 1. Check safety limits
 * 2. Set pendingHop → user sees approval banner/modal
 * 3. Wait for approval (or skip/stop)
 * 4. Walk visiting agent to target room (interruptIdleBehavior first)
 * 5. Run API call (streaming for live view, non-streaming for background)
 * 6. Persist hop result
 * 7. Walk agent home
 * 8. Repeat for template sequences
 *
 * Key design rules (from 17-RESEARCH.md):
 * - Non-streaming messages.create for initial agent call (tool_use only in finalMessage)
 * - Streaming messages.stream for target-agent responses in live view mode
 * - interruptIdleBehavior BEFORE every startWalk (prevents zombie-walk conflict, Pitfall 2)
 * - Track input_tokens + output_tokens for budget (Pitfall 6)
 *
 * Requirements: COLLAB-02, COLLAB-03, COLLAB-07, COLLAB-08
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AgentId } from '@/types/agent';
import { getAgent } from '@/config/agents';
import type { CollabChain, CollabHop, ConsultationRequest } from '@/types/collaboration';
import { getAnthropicClient } from '@/services/anthropic/client';
import { buildContext } from '@/services/context/builder';
import { retryWithBackoff } from '@/services/anthropic/retryBackoff';
import { DEFAULT_MODEL, MAX_OUTPUT_TOKENS } from '@/services/context/tokenCounter';
import { useCollaborationStore, collaboratingAgents } from '@/store/collaborationStore';
import { useChatStore } from '@/store/chatStore';
import { buildCollabContext, buildCollabContextLayer, buildHopUserMessage } from './contextBridge';
import { checkSafetyLimits, COLLAB_SAFETY } from './safetyLimits';
import { startWalk } from '@/engine/characters';
import { interruptIdleBehavior } from '@/engine/idleBehaviorManager';
import { ROOMS, OFFICE_TILE_MAP } from '@/engine/officeLayout';

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

/**
 * The request_consultation tool given to the originating agent.
 * When the agent decides a peer is needed, it emits a tool_use block
 * with this tool — the orchestrator receives it before any visible output.
 *
 * charlie excluded from enum — persona not yet configured (RESEARCH.md open question #1).
 */
export const CONSULTATION_TOOL: Anthropic.Tool = {
  name: 'request_consultation',
  description:
    'Request consultation from a specialist colleague. Use when you need domain expertise you do not have.',
  input_schema: {
    type: 'object' as const,
    properties: {
      target_agent_id: {
        type: 'string',
        enum: ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'],
        description: 'The ID of the agent to consult',
      },
      reason: {
        type: 'string',
        description:
          'One sentence explaining why this agent is needed and what they should produce',
      },
      estimated_tokens: {
        type: 'number',
        description: 'Rough estimate of tokens this consultation will consume (1000-8000)',
      },
    },
    required: ['target_agent_id', 'reason', 'estimated_tokens'] as const,
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Tool extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a consultation request from an Anthropic API response.
 * Returns null if the response does not contain a request_consultation tool_use block.
 */
export function extractConsultationRequest(
  response: Anthropic.Message,
): ConsultationRequest | null {
  if (response.stop_reason !== 'tool_use') return null;
  const block = response.content.find(
    b => b.type === 'tool_use' && b.name === 'request_consultation',
  );
  if (!block || block.type !== 'tool_use') return null;
  const input = block.input as {
    target_agent_id: AgentId;
    reason: string;
    estimated_tokens: number;
  };
  return {
    targetAgentId: input.target_agent_id,
    reason: input.reason,
    estimatedTokens: input.estimated_tokens,
  };
}

// ---------------------------------------------------------------------------
// Initial agent message (non-streaming — must capture tool_use in finalMessage)
// ---------------------------------------------------------------------------

/**
 * Sends the initial message to the originating agent using non-streaming
 * messages.create so that the full response (including tool_use blocks) is
 * available synchronously.
 *
 * Streaming cannot be used here because tool_use blocks only appear in
 * finalMessage, not in stream delta events (RESEARCH.md Pitfall 3).
 */
export async function sendInitialCollaborationMessage(
  originAgentId: AgentId,
  userInstruction: string,
  signal: AbortSignal,
): Promise<{
  prose: string;
  consultationRequest: ConsultationRequest | null;
  inputTokens: number;
  outputTokens: number;
}> {
  const client = getAnthropicClient();
  const context = buildContext(originAgentId, [], undefined, undefined);

  const response = await retryWithBackoff(() =>
    client.messages.create(
      {
        model: DEFAULT_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [{ type: 'text', text: context.systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userInstruction }],
        tools: [CONSULTATION_TOOL],
        tool_choice: { type: 'auto' },
      },
      { signal },
    ),
  );

  const prose = response.content
    .filter(b => b.type === 'text')
    .map(b => ('text' in b ? b.text : ''))
    .join('');

  return {
    prose,
    consultationRequest: extractConsultationRequest(response),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Walk helpers
// ---------------------------------------------------------------------------

/**
 * Walks the given agent to the billyStandTile of the target room.
 * Calls interruptIdleBehavior BEFORE startWalk to prevent zombie-walk
 * conflicts with the idle behavior system (RESEARCH.md Pitfall 2).
 */
async function walkToRoom(agentId: AgentId, targetRoomId: string): Promise<void> {
  const room = ROOMS.find(r => r.id === targetRoomId);
  if (!room) return;
  interruptIdleBehavior(agentId);
  startWalk(agentId, room.billyStandTile.col, room.billyStandTile.row, OFFICE_TILE_MAP);
  // startWalk is fire-and-forget; wait ~3s for animation to cover ~12 tiles
  await new Promise<void>(resolve => setTimeout(resolve, 3000));
}

/**
 * Walks the given agent back to their own desk seatTile.
 */
async function walkHome(agentId: AgentId): Promise<void> {
  const room = ROOMS.find(r => r.id === agentId);
  if (!room) return;
  interruptIdleBehavior(agentId);
  startWalk(agentId, room.seatTile.col, room.seatTile.row, OFFICE_TILE_MAP);
  await new Promise<void>(resolve => setTimeout(resolve, 3500));
}

// ---------------------------------------------------------------------------
// Single hop API call
// ---------------------------------------------------------------------------

/**
 * Runs a single target-agent hop.
 * Uses streaming for live view mode, non-streaming for background mode.
 */
async function runHop(
  chain: CollabChain,
  hop: CollabHop,
  injectedInstruction: string | undefined,
  signal: AbortSignal,
): Promise<{ result: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropicClient();
  const collabCtx = buildCollabContext(chain, injectedInstruction);

  // System layer tells the target WHO is visiting and the topic context
  const collabLayer = buildCollabContextLayer(collabCtx);
  const context = buildContext(hop.toAgentId, [], undefined, collabLayer);

  // User turn is a natural conversational request — not the raw context blob.
  // This is what the visiting agent "says" when they walk in.
  const userMessage = buildHopUserMessage(collabCtx, hop.reason);

  if (chain.viewMode === 'live') {
    let result = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const store = useCollaborationStore.getState();

    const stream = client.messages.stream(
      {
        model: DEFAULT_MODEL,
        max_tokens: COLLAB_SAFETY.MAX_OUTPUT_TOKENS,
        system: context.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal },
    );

    for await (const event of stream) {
      if (signal.aborted) break;
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        result += event.delta.text;
        store.updateLiveOutput(result);
      }
    }

    const finalMsg = await stream.finalMessage();
    inputTokens = finalMsg.usage.input_tokens;
    outputTokens = finalMsg.usage.output_tokens;
    return { result, inputTokens, outputTokens };
  } else {
    const response = await retryWithBackoff(() =>
      client.messages.create(
        {
          model: DEFAULT_MODEL,
          max_tokens: COLLAB_SAFETY.MAX_OUTPUT_TOKENS,
          system: context.systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        },
        { signal },
      ),
    );

    const result = response.content
      .filter(b => b.type === 'text')
      .map(b => ('text' in b ? b.text : ''))
      .join('');

    return {
      result,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

// ---------------------------------------------------------------------------
// Main orchestration loop
// ---------------------------------------------------------------------------

/**
 * Runs the collaboration chain for a single hop.
 *
 * Called by useCollaboration after the originating agent sends its initial
 * message and a consultation request is detected (or for each step in a
 * template sequence).
 *
 * Flow:
 * 1. Check safety limits → abort if exceeded
 * 2. Build hop object and register it as pendingHop (triggers approval UI)
 * 3. Wait for user decision (approve / skip / stop)
 * 4. Walk to target room (interruptIdleBehavior → startWalk → 2s delay)
 * 5. Run hop API call (streaming or non-streaming per viewMode)
 * 6. Complete hop, accumulate tokens
 * 7. Walk home → remove from collaboratingAgents
 * 8. Build chain summary and complete chain
 */
export async function runCollaborationChain(
  chain: CollabChain,
  firstHop: { targetAgentId: AgentId; reason: string; estimatedTokens: number },
): Promise<void> {
  const getStore = useCollaborationStore.getState;
  const signal = chain.abortController.signal;
  const currentTargetAgentId: AgentId = firstHop.targetAgentId;
  const currentReason: string = firstHop.reason;
  const hopIndex = chain.hops.length; // next hop index

  try {
    // Safety check before this hop
    const safety = checkSafetyLimits(chain);
    if (!safety.ok) {
      getStore().abortChain(safety.reason ?? 'Safety limit reached');
      return;
    }

    if (signal.aborted) {
      getStore().abortChain('User stopped chain');
      return;
    }

    // Build pending hop object
    const newHop: CollabHop = {
      hopIndex,
      fromAgentId: chain.originAgentId,
      toAgentId: currentTargetAgentId,
      reason: currentReason,
      estimatedTokens: firstHop.estimatedTokens,
      status: 'pending',
    };

    // Auto-approve: register newHop in the store AND approve it atomically.
    // Passing newHop ensures approveHop upserts it into activeChain.hops before
    // marking it approved — without this the hop is never tracked and both
    // completeHop and the summary builder silently find nothing to update.
    getStore().approveHop(chain.id, hopIndex, undefined, newHop);

    if (signal.aborted) {
      getStore().abortChain('User stopped chain');
      return;
    }

    const injectedInstruction = undefined;

    // Origin agent walks to the target's room (Isaac walks to Charlie's office)
    const originAgentId = chain.originAgentId;
    collaboratingAgents.add(originAgentId);
    await walkToRoom(originAgentId, currentTargetAgentId);

    // Re-read fresh chain state after walk (store may have updated)
    const chainForHop = getStore().activeChain ?? chain;

    // Run API hop
    // chainForHop.hops already contains newHop (registered by approveHop above),
    // so no inline spread is needed here.
    try {
      const { result, inputTokens, outputTokens } = await runHop(
        chainForHop,
        newHop,
        injectedInstruction,
        signal,
      );
      getStore().completeHop(chain.id, hopIndex, result, inputTokens + outputTokens);
    } catch (err) {
      collaboratingAgents.delete(originAgentId);
      await walkHome(originAgentId);
      getStore().abortChain(err instanceof Error ? err.message : 'Hop failed');
      return;
    }

    // Walk home
    await walkHome(originAgentId);
    collaboratingAgents.delete(originAgentId);
    getStore().clearLiveOutput();

    // Build summary from all completed hops and complete chain
    const freshChain = getStore().activeChain;
    if (freshChain) {
      const summary = freshChain.hops
        .filter(h => h.status === 'completed')
        .map(h => `**${h.toAgentId}**: ${h.result ?? '(no result)'}`)
        .join('\n\n');
      getStore().completeChain(summary || 'Collaboration completed.');

      // Inject the consultation result back into the origin agent's conversation
      // as a USER-role message so the agent knows it's information they RECEIVED
      // (not something they said). This lets them reference it naturally in
      // follow-up replies without re-triggering a consultation.
      const completedHopAgentId = freshChain.hops.find(h => h.status === 'completed')?.toAgentId;
      const targetAgent = completedHopAgentId ? getAgent(completedHopAgentId) : undefined;
      const targetName = targetAgent?.name ?? currentTargetAgentId;
      const resultText = summary
        ? `[You just consulted with ${targetName}. Here is what they told you:]\n\n${summary}`
        : `[Your consultation with ${targetName} is complete but they had no specific findings to report.]`;
      const chatStore = useChatStore.getState();
      const convId = chatStore.activeConversationId;
      if (convId) {
        await chatStore.addMessage(convId, {
          conversationId: convId,
          role: 'user',
          content: resultText,
        });
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      getStore().abortChain(err instanceof Error ? err.message : 'Unknown error in chain');
    }
  }
}
