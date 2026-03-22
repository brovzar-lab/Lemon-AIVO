export type AgentId = 'patrik' | 'marcos' | 'sandra' | 'isaac' | 'wendy' | 'charlie';
export type AgentStatus = 'idle' | 'thinking' | 'needs-attention';

export interface AgentPersona {
  id: AgentId;
  name: string;
  title: string;
  color: string;           // Hex color for UI identification
  systemPrompt: string;    // Full assembled system prompt
  personality: string;     // Short description for UI display
  domain: string;          // Domain expertise description
  status: AgentStatus;
}
