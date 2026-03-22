import type { CollabContext, CollabChain } from '@/types/collaboration';
import { getAgent } from '@/config/agents';

const MAX_FINDING_CHARS = 400;

/**
 * Builds the system-prompt layer injected into the TARGET agent's context.
 * Tells the target who is visiting and why, so they respond to the right person.
 */
export function buildCollabContextLayer(ctx: CollabContext): string {
  const lines: string[] = [];

  if (ctx.visitorName && ctx.visitorTitle) {
    lines.push(
      `## Colleague Visit\nYour colleague **${ctx.visitorName}** (${ctx.visitorTitle}) has come to your office to consult with you. Respond directly to them as you would in a real office conversation — concise, expert, and collegial.`,
    );
  }

  lines.push(`## Consultation Topic\n${ctx.taskSummary}`);

  if (ctx.priorFindings.length > 0) {
    lines.push('## Prior Findings');
    for (const finding of ctx.priorFindings) {
      const summary =
        finding.summary.length > MAX_FINDING_CHARS
          ? finding.summary.slice(0, MAX_FINDING_CHARS - 3) + '...'
          : finding.summary;
      lines.push(`### ${finding.agentName}\n${summary}`);
    }
  }

  if (ctx.userInstruction) {
    lines.push(`## Additional Context\n${ctx.userInstruction}`);
  }

  return lines.join('\n\n');
}

/**
 * Builds the natural user-turn message that the visiting agent "says" to the target.
 * This is the actual prompt the target agent responds to — not the system blob.
 */
export function buildHopUserMessage(ctx: CollabContext, reason: string): string {
  const from = ctx.visitorName ? `${ctx.visitorName} here.` : 'Hey.';
  return `${from} I need your input: ${reason}`;
}

/**
 * Builds a CollabContext struct from a running chain's completed hops.
 * Includes origin agent identity so the target knows who is visiting.
 */
export function buildCollabContext(
  chain: CollabChain,
  userInstruction?: string,
): CollabContext {
  const originAgent = getAgent(chain.originAgentId);
  const priorFindings = chain.hops
    .filter(h => h.status === 'completed' && h.result)
    .map(h => {
      const agent = getAgent(h.toAgentId);
      return { agentName: agent?.name ?? h.toAgentId, summary: h.result ?? '' };
    });

  return {
    taskSummary: chain.initialTask,
    priorFindings,
    userInstruction,
    visitorName: originAgent?.name,
    visitorTitle: originAgent?.title,
  };
}
