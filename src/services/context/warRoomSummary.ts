import type { AgentId } from '@/types/agent';
import { getAgent } from '@/config/agents';

/**
 * Generate a cross-visibility summary block for War Room follow-up messages.
 * Each agent sees a compact summary (~200 tokens total) of what the other 4 agents
 * said in the previous round. Uses simple truncation (~160 chars per agent) for
 * zero-latency context injection.
 *
 * @param currentAgentId - The agent receiving this context (excluded from summary)
 * @param previousResponses - Map of agentId -> previous round response text
 * @returns Formatted summary block string, or empty string if no other responses exist
 */
export function buildCrossVisibilityBlock(
  currentAgentId: AgentId,
  previousResponses: Record<string, string>,
): string {
  const otherAgents = Object.entries(previousResponses)
    .filter(([id]) => id !== currentAgentId);

  if (otherAgents.length === 0) return '';

  const summaries = otherAgents.map(([id, response]) => {
    const agent = getAgent(id as AgentId);
    const truncated = response.slice(0, 160).trimEnd();
    const ellipsis = response.length > 160 ? '...' : '';
    return `- ${agent?.name ?? id} (${agent?.title ?? ''}): ${truncated}${ellipsis}`;
  });

  return `[War Room Context -- Previous round responses from your colleagues]\n${summaries.join('\n')}`;
}
