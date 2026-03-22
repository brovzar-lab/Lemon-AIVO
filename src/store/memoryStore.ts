import { create } from 'zustand';
import type { AgentId } from '@/types/agent';
import type { MemoryFact } from '@/types/memory';
import { getPersistence } from '@/services/persistence/adapter';

interface MemoryState {
  facts: MemoryFact[];
  isExtracting: boolean;

  loadFacts: (dealId: string) => Promise<void>;
  addFacts: (facts: MemoryFact[]) => Promise<void>;
  removeFact: (factId: string) => Promise<void>;
  getFactsForAgent: (agentId: AgentId, dealId: string) => MemoryFact[];
  getFactsForDeal: (dealId: string) => MemoryFact[];
  setExtracting: (value: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  facts: [],
  isExtracting: false,

  loadFacts: async (dealId: string) => {
    const persistence = getPersistence();
    const facts = await persistence.query<MemoryFact>('memory', 'dealId', dealId);
    set({ facts });
  },

  addFacts: async (facts: MemoryFact[]) => {
    const persistence = getPersistence();
    for (const fact of facts) {
      await persistence.set('memory', fact.id, fact);
    }
    set((state) => ({
      facts: [...state.facts, ...facts],
    }));
  },

  removeFact: async (factId: string) => {
    const persistence = getPersistence();
    await persistence.delete('memory', factId);
    set((state) => ({
      facts: state.facts.filter((f) => f.id !== factId),
    }));
  },

  getFactsForAgent: (agentId: AgentId, dealId: string) => {
    return get().facts.filter((f) => f.agentId === agentId && f.dealId === dealId);
  },

  getFactsForDeal: (dealId: string) => {
    return get().facts.filter((f) => f.dealId === dealId);
  },

  setExtracting: (value: boolean) => {
    set({ isExtracting: value });
  },
}));
