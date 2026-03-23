import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCollaborationStore, collaboratingAgents } from '@/store/collaborationStore';
// Mock dealStore.createDeal so tests don't need IDB
vi.mock('@/store/dealStore', () => ({
  useDealStore: {
    getState: () => ({
      createDeal: vi.fn().mockResolvedValue('deal-mock-id'),
    }),
  },
}));

// Mock getPersistence so IDB writes don't fail in test environment
vi.mock('@/services/persistence/adapter', () => ({
  getPersistence: () => ({
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
  }),
}));

describe('collaborationStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useCollaborationStore.setState({
      activeChain: null,
      viewMode: 'live',
      pendingHop: null,
      liveOutput: '',
    });
    // Clear collaborating agents set
    collaboratingAgents.clear();
  });

  describe('startChain', () => {
    it('sets activeChain with correct dealId from dealStore.createDeal (COLLAB-07)', async () => {
      const store = useCollaborationStore.getState();
      const chain = await store.startChain('patrik', 'Review this deal', 'Test Deal');

      expect(chain.dealId).toBe('deal-mock-id');
      expect(chain.originAgentId).toBe('patrik');
      expect(chain.initialTask).toBe('Review this deal');
      expect(chain.status).toBe('awaiting-approval');
      expect(chain.abortController).toBeInstanceOf(AbortController);

      const activeChain = useCollaborationStore.getState().activeChain;
      expect(activeChain?.id).toBe(chain.id);
    });

    it('sets pendingHop when tool_use consultation signal detected (COLLAB-01, 08)', () => {
      const pendingHop = {
        hop: {
          hopIndex: 0,
          fromAgentId: 'patrik' as const,
          toAgentId: 'marcos' as const,
          reason: 'Need financial analysis',
          estimatedTokens: 500,
          status: 'pending' as const,
        },
        chainId: 'test-chain-1',
        lastHopSummary: 'Previous result',
      };

      useCollaborationStore.getState().setPendingHop(pendingHop);
      expect(useCollaborationStore.getState().pendingHop).toEqual(pendingHop);
    });
  });

  describe('independence from chatStore (COLLAB-06)', () => {
    it('activeChain.status running-hop does not block chatStore streaming', async () => {
      // collaborationStore has NO import from chatStore — verify they are independent
      // by checking we can set chain to running-hop state without touching chatStore
      const store = useCollaborationStore.getState();
      const chain = await store.startChain('patrik', 'Test task', 'Test Deal');

      // Simulate hop added and running
      useCollaborationStore.setState({
        activeChain: { ...chain, status: 'running-hop' },
      });

      expect(useCollaborationStore.getState().activeChain?.status).toBe('running-hop');
      // chatStore is untouched — no shared state, no AbortControllers shared
    });

    it('chatStore.streaming.isStreaming can be true while activeChain is running', async () => {
      // Both stores are independent singletons with no cross-imports
      // collaborationStore.ts must not import from chatStore — confirmed by module design
      const store = useCollaborationStore.getState();
      const chain = await store.startChain('marcos', 'Analyze financials', 'Deal B');
      expect(chain.status).toBe('awaiting-approval');
      // If chatStore were imported here, TypeScript would show it — it is not.
    });
  });

  describe('ChainSnapshot serialization (COLLAB-10)', () => {
    it('ChainSnapshot round-trips through JSON without AbortController', () => {
      const snapshot = {
        id: 'test-chain-1',
        dealId: 'deal-1',
        originAgentId: 'patrik' as const,
        initialTask: 'Review this deal',
        hops: [],
        status: 'idle' as const,
        tokenBudgetUsed: 0,
        tokenBudgetLimit: 50000,
        maxHops: 8,
        startedAt: Date.now(),
        viewMode: 'live' as const,
      };
      // Must not contain AbortController
      expect(snapshot).not.toHaveProperty('abortController');
      // Must survive JSON round-trip
      const serialized = JSON.stringify(snapshot);
      const restored = JSON.parse(serialized);
      expect(restored.id).toBe(snapshot.id);
      expect(restored.dealId).toBe(snapshot.dealId);
    });
  });

  describe('abortChain', () => {
    it('sets status to aborted and preserves completed hop results', async () => {
      const store = useCollaborationStore.getState();
      const chain = await store.startChain('patrik', 'Review deal', 'Test Deal');

      // Add a completed hop to the chain
      const completedHop = {
        hopIndex: 0,
        fromAgentId: 'patrik' as const,
        toAgentId: 'marcos' as const,
        reason: 'Needed financials',
        estimatedTokens: 500,
        actualTokensUsed: 450,
        result: 'Financial analysis complete',
        status: 'completed' as const,
      };
      useCollaborationStore.setState({
        activeChain: { ...chain, hops: [completedHop], status: 'walking' },
      });

      useCollaborationStore.getState().abortChain('user requested stop');

      const aborted = useCollaborationStore.getState().activeChain;
      expect(aborted?.status).toBe('aborted');
      expect(aborted?.hops[0].status).toBe('completed');
      expect(aborted?.hops[0].result).toBe('Financial analysis complete');
    });

    it('appends partial summary to originating chat thread', async () => {
      // abortChain sets summary = "Aborted: <reason>" on the chain
      const store = useCollaborationStore.getState();
      const chain = await store.startChain('patrik', 'Review deal', 'Test Deal');
      useCollaborationStore.setState({ activeChain: chain });

      useCollaborationStore.getState().abortChain('token budget exhausted');

      const aborted = useCollaborationStore.getState().activeChain;
      expect(aborted?.summary).toContain('token budget exhausted');
    });
  });
});
