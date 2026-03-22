import type { AgentId } from './agent';

export type MemoryCategory =
  | 'decision'       // "Decided to proceed with 3-tranche waterfall"
  | 'financial'      // "$2.4M USD production budget"
  | 'date'           // "Principal photography starts June 15, 2026"
  | 'action-item'    // "Need to file EFICINE application by April 30"
  | 'entity'         // "Co-producer: Videocine"
  | 'assumption'     // "Assuming 35% EFICINE tax credit applies"
  | 'risk'           // "Currency risk on MXN/USD if peso weakens beyond 19.5"
  | 'term';          // "Hurdle rate set at 8% IRR"

export interface MemoryFact {
  id: string;                // crypto.randomUUID()
  agentId: AgentId;          // Which agent extracted this
  dealId: string;            // Which deal this belongs to
  category: MemoryCategory;  // Structured category
  content: string;           // The fact itself (1-2 sentences max)
  confidence: 'high' | 'medium' | 'low';  // How certain the extraction is
  sourceAgentId: AgentId;    // Original agent (for cross-agent attribution)
  createdAt: number;         // Date.now()
  updatedAt: number;         // Last confirmed/updated
}
