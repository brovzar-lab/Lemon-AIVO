import type { AgentId } from '@/types/agent';
import type { MessageRole, Conversation } from '@/types/chat';
import { BASE_SYSTEM_PROMPT } from '@/config/prompts/base';
import { getAgent } from '@/config/agents';
import { estimateTokens } from './tokenCounter';
import { useDealStore } from '@/store/dealStore';
import { useFileStore } from '@/store/fileStore';
import { useMemoryStore } from '@/store/memoryStore';

export interface BuiltContext {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  totalTokens: number;
}

/**
 * Assembles the layered system prompt and formats conversation messages
 * for the Anthropic API call.
 *
 * Layers:
 * 1. Base system prompt (shared rules)
 * 2. Agent persona prompt
 * 2.5. (Optional) Cross-visibility block for War Room follow-ups
 * 3. Deal context (name + description of active deal)
 * 4. File summaries (uploaded documents per agent/deal)
 * 5. Agent memory (own-agent + cross-agent facts)
 * 6. Conversation history (with summary support)
 */
export function buildContext(
  agentId: AgentId,
  messages: Array<{ role: MessageRole; content: string }>,
  conversation?: Conversation,
  crossVisibilityBlock?: string,
): BuiltContext {
  // Layer 1: Base system prompt
  const layers: string[] = [BASE_SYSTEM_PROMPT];

  // Layer 2: Agent persona prompt
  const agent = getAgent(agentId);
  if (agent) {
    layers.push(agent.personaPrompt);
  }

  // Layer 2.5: Cross-visibility block for War Room follow-ups (optional)
  if (crossVisibilityBlock) {
    layers.push(crossVisibilityBlock);
  }

  // Layer 3: Deal context
  const { activeDealId, deals } = useDealStore.getState();
  if (activeDealId) {
    const activeDeal = deals.find(d => d.id === activeDealId);
    if (activeDeal) {
      let dealContext = `You are currently advising on the deal: ${activeDeal.name}.`;
      if (activeDeal.description) {
        dealContext += ` Description: ${activeDeal.description}`;
      }
      layers.push(dealContext);
    }
  }

  // Layer 4: File summaries
  const FILE_TOKEN_CAP = 2000;       // ~8000 chars per file
  const TOTAL_FILE_TOKEN_CAP = 8000; // max tokens for all files combined

  const { files } = useFileStore.getState();
  const agentFiles = files.filter(f => f.agentId === agentId && f.dealId === activeDealId);

  if (agentFiles.length > 0) {
    let fileBlock = '## Uploaded Documents\n\n';
    let usedTokens = 0;

    for (const file of agentFiles) {
      const maxChars = FILE_TOKEN_CAP * 4;
      let text = file.extractedText;
      if (text.length > maxChars) {
        text = text.slice(0, maxChars) + '\n\n[... truncated, showing first portion of document]';
      }
      const tokens = estimateTokens(text);
      if (usedTokens + tokens > TOTAL_FILE_TOKEN_CAP) break;
      fileBlock += `### ${file.name}\n${text}\n\n`;
      usedTokens += tokens;
    }

    layers.push(fileBlock);
  }

  // Layer 5: Agent memory (own-agent + cross-agent facts)
  const MEMORY_TOKEN_CAP = 2000;
  const CROSS_AGENT_TOKEN_CAP = 2000;

  const { facts: allFacts } = useMemoryStore.getState();
  const currentDealId = activeDealId;

  // Own-agent facts
  if (currentDealId) {
    const ownFacts = allFacts
      .filter((f) => f.agentId === agentId && f.dealId === currentDealId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (ownFacts.length > 0) {
      let memoryBlock = '## Your Memory\n\n';
      let usedTokens = 0;

      for (const fact of ownFacts) {
        const line = `- [${fact.category}] ${fact.content}\n`;
        const lineTokens = estimateTokens(line);
        if (usedTokens + lineTokens > MEMORY_TOKEN_CAP) break;
        memoryBlock += line;
        usedTokens += lineTokens;
      }

      layers.push(memoryBlock);
    }

    // Cross-agent facts
    const crossFacts = allFacts
      .filter((f) => f.agentId !== agentId && f.dealId === currentDealId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (crossFacts.length > 0) {
      // Group by agentId
      const grouped: Record<string, typeof crossFacts> = {};
      let crossUsedTokens = 0;

      for (const fact of crossFacts) {
        const line = `- [${fact.category}] ${fact.content}\n`;
        const lineTokens = estimateTokens(line);
        if (crossUsedTokens + lineTokens > CROSS_AGENT_TOKEN_CAP) break;

        if (!grouped[fact.agentId]) {
          grouped[fact.agentId] = [];
        }
        grouped[fact.agentId]!.push(fact);
        crossUsedTokens += lineTokens;
      }

      let crossBlock = "## Other Advisors' Notes\n\n";
      for (const [aid, facts] of Object.entries(grouped)) {
        const agentConfig = getAgent(aid as AgentId);
        const agentName = agentConfig?.name ?? aid.charAt(0).toUpperCase() + aid.slice(1);
        crossBlock += `### ${agentName}\n`;
        for (const fact of facts) {
          crossBlock += `- [${fact.category}] ${fact.content}\n`;
        }
        crossBlock += '\n';
      }

      layers.push(crossBlock);
    }
  }

  // Layer 5.5: Deal creation capability (only when deal context is active)
  if (activeDealId) {
    layers.push(`## Deal Creation Capability
When the user asks you to create a deal (e.g. "create a deal for this contract", "set up a deal", "make a deal for this"), respond naturally and include this exact tag on its own line:
<create-deal name="Short Deal Name" description="One sentence summary of the deal"/>
Use the contract name or a concise descriptive title for \`name\`. Write a clear one-sentence summary for \`description\`. Do not wrap the tag in backticks or code blocks.`);
  }

  const systemPrompt = layers.join('\n\n');

  // Layer 6: Conversation history with summary support
  const formattedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // If the conversation has a summary, prepend it as context
  if (conversation?.summary) {
    formattedMessages.push({
      role: 'assistant',
      content: `[Previous conversation summary]: ${conversation.summary}`,
    });
  }

  // Add the actual messages
  for (const msg of messages) {
    formattedMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Calculate total token usage
  let totalTokens = estimateTokens(systemPrompt);
  for (const msg of formattedMessages) {
    totalTokens += estimateTokens(msg.content);
  }

  return {
    systemPrompt,
    messages: formattedMessages,
    totalTokens,
  };
}
