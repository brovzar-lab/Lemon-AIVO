/**
 * useCollaboration — React hook bridging collaborationStore + chainRunner for UI components.
 *
 * Exposes:
 * - startChain: free-form collaboration triggered by agent tool_use detection
 * - startTemplate: collaboration from a pre-built template sequence
 * - approveHop / skipHop / abortChain: approval gate controls
 * - Chain state: activeChain, pendingHop, viewMode, liveOutput
 * - templates: all pre-built CHAIN_TEMPLATES for display in UI
 *
 * Requirements: COLLAB-01, COLLAB-02, COLLAB-05, COLLAB-07, COLLAB-08
 */
import { useCollaborationStore } from '@/store/collaborationStore';
import {
  runCollaborationChain,
  sendInitialCollaborationMessage,
} from '@/services/collaboration/chainRunner';
import { CHAIN_TEMPLATES, getTemplate, expandTemplate } from '@/services/collaboration/chainTemplates';
import type { AgentId } from '@/types/agent';
import { useChatStore } from '@/store/chatStore';

export function useCollaboration() {
  const store = useCollaborationStore();

  /**
   * Starts a free-form collaboration chain triggered by the user's natural
   * language instruction to the originating agent.
   *
   * Flow:
   * 1. Create sub-deal + CollabChain in collaborationStore
   * 2. Send initial message to originating agent (non-streaming — need tool_use)
   * 3. Append agent's prose acknowledgment to its chat thread
   * 4. If agent detected a consultation request → run the chain
   * 5. If no consultation needed → complete immediately
   */
  async function startChain(
    originAgentId: AgentId,
    userInstruction: string,
  ): Promise<void> {
    const dealName = `Collaboration: ${originAgentId} — ${new Date().toLocaleDateString()}`;
    const chain = await useCollaborationStore.getState().startChain(
      originAgentId,
      userInstruction,
      dealName,
    );

    // Send initial message to originating agent (non-streaming)
    const { prose, consultationRequest } = await sendInitialCollaborationMessage(
      originAgentId,
      userInstruction,
      chain.abortController.signal,
    );

    // Append originating agent's prose to its chat thread
    if (prose) {
      const convId = useChatStore.getState().activeConversationId;
      if (convId) {
        await useChatStore.getState().addMessage(convId, {
          role: 'assistant',
          content: prose,
        });
      }
    }

    if (!consultationRequest) {
      // Agent decided no consultation needed — complete chain immediately
      useCollaborationStore.getState().completeChain(prose || 'No consultation needed.');
      return;
    }

    // Run the chain with the first detected consultation request
    await runCollaborationChain(chain, {
      targetAgentId: consultationRequest.targetAgentId,
      reason: consultationRequest.reason,
      estimatedTokens: consultationRequest.estimatedTokens,
    });
  }

  /**
   * Starts a collaboration chain from a pre-built template.
   * Bypasses tool_use detection — uses the template's fixed agent sequence.
   * Each hop in the sequence still requires per-hop user approval.
   */
  async function startTemplate(
    templateId: string,
    taskDescription: string,
    originAgentId: AgentId,
  ): Promise<void> {
    const template = getTemplate(templateId);
    if (!template || template.sequence.length === 0) return;

    const task = expandTemplate(template, taskDescription);
    const dealName = `${template.name}: ${taskDescription.slice(0, 40)}`;
    await useCollaborationStore.getState().startChain(
      originAgentId,
      task,
      dealName,
    );

    // Fire each hop in sequence; each requires per-hop approval
    for (const targetAgentId of template.sequence) {
      // Re-read chain state before each hop to check for abort
      const currentChain = useCollaborationStore.getState().activeChain;
      if (!currentChain || currentChain.status === 'aborted') break;

      await runCollaborationChain(
        currentChain,
        {
          targetAgentId,
          reason: `Part of ${template.name} pipeline`,
          estimatedTokens: 3000,
        },
      );

      // After each hop, check if chain was aborted or completed
      const afterChain = useCollaborationStore.getState().activeChain;
      if (!afterChain || afterChain.status === 'aborted' || afterChain.status === 'completed') break;
    }
  }

  return {
    activeChain: store.activeChain,
    pendingHop: store.pendingHop,
    viewMode: store.viewMode,
    liveOutput: store.liveOutput,
    templates: CHAIN_TEMPLATES,
    startChain,
    startTemplate,
    approveHop: useCollaborationStore.getState().approveHop,
    skipHop: useCollaborationStore.getState().skipHop,
    abortChain: useCollaborationStore.getState().abortChain,
    setViewMode: useCollaborationStore.getState().setViewMode,
  };
}
