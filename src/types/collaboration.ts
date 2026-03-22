import type { AgentId } from '@/types/agent';

export type ChainStatus =
  | 'idle'
  | 'awaiting-approval'
  | 'walking'
  | 'running-hop'
  | 'completed'
  | 'aborted'
  | 'error';

export type HopStatus = 'pending' | 'approved' | 'skipped' | 'completed' | 'failed';

export type HopDecision = 'approve' | 'approve-with-instruction' | 'skip' | 'stop';

export interface CollabHop {
  hopIndex: number;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  reason: string;
  estimatedTokens: number;
  actualTokensUsed?: number;
  result?: string;
  status: HopStatus;
}

/**
 * ChainSnapshot: fully JSON-serializable — safe for IndexedDB.
 * CollabChain extends this with runtime-only fields (AbortController).
 */
export interface ChainSnapshot {
  id: string;
  dealId: string;
  originAgentId: AgentId;
  initialTask: string;
  hops: CollabHop[];
  status: ChainStatus;
  tokenBudgetUsed: number;
  tokenBudgetLimit: number;
  maxHops: number;
  startedAt: number;
  completedAt?: number;
  summary?: string;
  viewMode: 'live' | 'background';
}

/** Full runtime chain — includes AbortController (NOT persisted to IDB). */
export interface CollabChain extends ChainSnapshot {
  abortController: AbortController;
}

export interface CollabContext {
  taskSummary: string;
  priorFindings: Array<{
    agentName: string;
    summary: string; // Max 400 chars
  }>;
  userInstruction?: string;
  visitorName?: string;  // Origin agent's display name
  visitorTitle?: string; // Origin agent's company title
}

export interface ChainTemplate {
  id: string;
  name: string;
  description: string;
  sequence: AgentId[];
  taskTemplate: string; // Contains {taskDescription} placeholder
}

export interface ConsultationRequest {
  targetAgentId: AgentId;
  reason: string;
  estimatedTokens: number;
}

export interface PendingHop {
  hop: CollabHop;
  chainId: string;
  lastHopSummary?: string; // Previous hop result, shown in approval modal
}
