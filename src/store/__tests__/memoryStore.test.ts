import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryFact } from '@/types/memory';

// In-memory persistence mock
const mockStore = new Map<string, unknown>();
const mockPersistence = {
  get: vi.fn((_store: string, key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((_store: string, key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  delete: vi.fn((_store: string, key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
  getAll: vi.fn(() => Promise.resolve(Array.from(mockStore.values()))),
  query: vi.fn((_store: string, _index: string, _value: string) => Promise.resolve([])),
  bulkSet: vi.fn(() => Promise.resolve()),
  clear: vi.fn(() => {
    mockStore.clear();
    return Promise.resolve();
  }),
};

vi.mock('@/services/persistence/adapter', () => ({
  getPersistence: () => mockPersistence,
}));

const makeFact = (overrides: Partial<MemoryFact> = {}): MemoryFact => ({
  id: 'fact-1',
  agentId: 'patrik',
  dealId: 'deal-1',
  category: 'financial',
  content: 'Budget is $2M',
  confidence: 'high',
  sourceAgentId: 'patrik',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe('memoryStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.clear();
    mockPersistence.query.mockResolvedValue([]);

    // Reset store between tests
    const { useMemoryStore } = await import('@/store/memoryStore');
    useMemoryStore.setState({ facts: [], isExtracting: false });
  });

  describe('loadFacts', () => {
    it('queries IndexedDB memory store by dealId index and populates state.facts', async () => {
      const facts = [makeFact(), makeFact({ id: 'fact-2', agentId: 'marcos' })];
      (mockPersistence.query as ReturnType<typeof vi.fn>).mockResolvedValue(facts);

      const { useMemoryStore } = await import('@/store/memoryStore');
      await useMemoryStore.getState().loadFacts('deal-1');

      expect(mockPersistence.query).toHaveBeenCalledWith('memory', 'dealId', 'deal-1');
      expect(useMemoryStore.getState().facts).toEqual(facts);
    });

    it('replaces existing facts (not appends) to prevent stale data on deal switch', async () => {
      const { useMemoryStore } = await import('@/store/memoryStore');

      // Pre-populate with old facts
      useMemoryStore.setState({
        facts: [makeFact({ id: 'old-1', dealId: 'deal-old' })],
      });

      const newFacts = [makeFact({ id: 'new-1', dealId: 'deal-2' })];
      (mockPersistence.query as ReturnType<typeof vi.fn>).mockResolvedValue(newFacts);

      await useMemoryStore.getState().loadFacts('deal-2');

      expect(useMemoryStore.getState().facts).toEqual(newFacts);
      expect(useMemoryStore.getState().facts).toHaveLength(1);
      expect(useMemoryStore.getState().facts[0]!.id).toBe('new-1');
    });
  });

  describe('addFacts', () => {
    it('persists each fact to IndexedDB and appends to state.facts', async () => {
      const { useMemoryStore } = await import('@/store/memoryStore');
      const facts = [makeFact(), makeFact({ id: 'fact-2', category: 'decision' })];

      await useMemoryStore.getState().addFacts(facts);

      expect(mockPersistence.set).toHaveBeenCalledTimes(2);
      expect(mockPersistence.set).toHaveBeenCalledWith('memory', 'fact-1', facts[0]);
      expect(mockPersistence.set).toHaveBeenCalledWith('memory', 'fact-2', facts[1]);
      expect(useMemoryStore.getState().facts).toHaveLength(2);
    });
  });

  describe('removeFact', () => {
    it('deletes from IndexedDB and removes from state.facts', async () => {
      const { useMemoryStore } = await import('@/store/memoryStore');
      useMemoryStore.setState({
        facts: [makeFact({ id: 'f1' }), makeFact({ id: 'f2' })],
      });

      await useMemoryStore.getState().removeFact('f1');

      expect(mockPersistence.delete).toHaveBeenCalledWith('memory', 'f1');
      expect(useMemoryStore.getState().facts).toHaveLength(1);
      expect(useMemoryStore.getState().facts[0]!.id).toBe('f2');
    });
  });

  describe('getFactsForAgent', () => {
    it('filters state.facts by both agentId and dealId', async () => {
      const { useMemoryStore } = await import('@/store/memoryStore');
      useMemoryStore.setState({
        facts: [
          makeFact({ id: 'f1', agentId: 'patrik', dealId: 'deal-1' }),
          makeFact({ id: 'f2', agentId: 'marcos', dealId: 'deal-1' }),
          makeFact({ id: 'f3', agentId: 'patrik', dealId: 'deal-2' }),
        ],
      });

      const result = useMemoryStore.getState().getFactsForAgent('patrik', 'deal-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('f1');
    });
  });

  describe('getFactsForDeal', () => {
    it('filters state.facts by dealId only (all agents)', async () => {
      const { useMemoryStore } = await import('@/store/memoryStore');
      useMemoryStore.setState({
        facts: [
          makeFact({ id: 'f1', agentId: 'patrik', dealId: 'deal-1' }),
          makeFact({ id: 'f2', agentId: 'marcos', dealId: 'deal-1' }),
          makeFact({ id: 'f3', agentId: 'patrik', dealId: 'deal-2' }),
        ],
      });

      const result = useMemoryStore.getState().getFactsForDeal('deal-1');
      expect(result).toHaveLength(2);
      expect(result.map(f => f.id).sort()).toEqual(['f1', 'f2']);
    });
  });

  describe('setExtracting', () => {
    it('toggles isExtracting state', async () => {
      const { useMemoryStore } = await import('@/store/memoryStore');

      expect(useMemoryStore.getState().isExtracting).toBe(false);

      useMemoryStore.getState().setExtracting(true);
      expect(useMemoryStore.getState().isExtracting).toBe(true);

      useMemoryStore.getState().setExtracting(false);
      expect(useMemoryStore.getState().isExtracting).toBe(false);
    });
  });
});
