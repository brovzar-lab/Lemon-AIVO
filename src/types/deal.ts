export type DealStatus = 'active' | 'archived' | 'deleted';

export interface Deal {
  id: string;
  name: string;
  description?: string;
  status: DealStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;   // Set when soft-deleted, TTL 7 days
}

export interface DealSummary extends Deal {
  lastActivity: number;
  agentActivity: Record<string, number>;
}
