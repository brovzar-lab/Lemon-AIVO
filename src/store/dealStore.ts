import { create } from 'zustand';
import type { Deal } from '@/types/deal';
import { getPersistence } from '@/services/persistence/adapter';
import { useChatStore } from '@/store/chatStore';

interface DealState {
  activeDealId: string | null;
  deals: Deal[];

  // Actions
  loadDeals: () => Promise<void>;
  createDeal: (name: string, description?: string) => Promise<string>;
  renameDeal: (dealId: string, newName: string) => Promise<void>;
  updateDealDescription: (dealId: string, description: string) => Promise<void>;
  archiveDeal: (dealId: string) => Promise<void>;
  softDeleteDeal: (dealId: string) => Promise<void>;
  switchDeal: (dealId: string) => Promise<void>;
  ensureDefaultDeal: () => Promise<void>;
  deleteDealCascade: (dealId: string) => Promise<void>;
}

export const useDealStore = create<DealState>((set, get) => ({
  activeDealId: null,
  deals: [],

  loadDeals: async () => {
    const persistence = getPersistence();
    const deals = await persistence.getAll<Deal>('deals');
    deals.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ deals });
  },

  createDeal: async (name: string, description?: string) => {
    const now = Date.now();
    const deal: Deal = {
      id: crypto.randomUUID(),
      name,
      ...(description !== undefined ? { description } : {}),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const persistence = getPersistence();
    await persistence.set('deals', deal.id, deal);
    set((state) => ({ deals: [deal, ...state.deals] }));
    return deal.id;
  },

  renameDeal: async (dealId: string, newName: string) => {
    const { deals } = get();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const updated: Deal = { ...deal, name: newName, updatedAt: Date.now() };
    const persistence = getPersistence();
    await persistence.set('deals', dealId, updated);
    set((state) => ({
      deals: state.deals.map(d => d.id === dealId ? updated : d),
    }));
  },

  updateDealDescription: async (dealId: string, description: string) => {
    const { deals } = get();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const updated: Deal = { ...deal, description, updatedAt: Date.now() };
    const persistence = getPersistence();
    await persistence.set('deals', dealId, updated);
    set((state) => ({
      deals: state.deals.map(d => d.id === dealId ? updated : d),
    }));
  },

  archiveDeal: async (dealId: string) => {
    const { deals } = get();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const updated: Deal = { ...deal, status: 'archived', updatedAt: Date.now() };
    const persistence = getPersistence();
    await persistence.set('deals', dealId, updated);
    set((state) => ({
      deals: state.deals.map(d => d.id === dealId ? updated : d),
    }));
  },

  softDeleteDeal: async (dealId: string) => {
    const { deals } = get();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const now = Date.now();
    const updated: Deal = { ...deal, status: 'deleted', deletedAt: now, updatedAt: now };
    const persistence = getPersistence();
    await persistence.set('deals', dealId, updated);
    set((state) => ({
      deals: state.deals.map(d => d.id === dealId ? updated : d),
    }));
  },

  switchDeal: async (dealId: string) => {
    // 1. Abort any in-flight streaming first
    const chatState = useChatStore.getState();
    if (chatState.streaming.isStreaming) {
      chatState.streaming.abortController?.abort();
      chatState.stopStreaming();
    }

    // 2. Update active deal ID synchronously
    set({ activeDealId: dealId });

    // 3. Reload deal-scoped conversations
    await useChatStore.getState().loadConversations();
  },

  ensureDefaultDeal: async () => {
    const { deals } = get();
    if (deals.length > 0) return;

    const now = Date.now();
    const defaultDeal: Deal = {
      id: 'default',
      name: 'General',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const persistence = getPersistence();
    await persistence.set('deals', defaultDeal.id, defaultDeal);
    set({ deals: [defaultDeal], activeDealId: 'default' });
  },

  deleteDealCascade: async (dealId: string) => {
    const persistence = getPersistence();

    // 1. Find all conversations belonging to this deal
    const conversations = await persistence.query<{ id: string }>('conversations', 'dealId', dealId);

    // 2. For each conversation, find and delete its messages
    for (const conv of conversations) {
      const messages = await persistence.query<{ id: string }>('messages', 'conversationId', conv.id);
      for (const msg of messages) {
        await persistence.delete('messages', msg.id);
      }
      await persistence.delete('conversations', conv.id);
    }

    // 3. Delete the deal itself
    await persistence.delete('deals', dealId);

    // 4. Remove from state
    set((state) => ({
      deals: state.deals.filter(d => d.id !== dealId),
    }));
  },
}));
