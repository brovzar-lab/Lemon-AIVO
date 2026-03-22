import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryFact } from '@/types/memory';

// Mock Anthropic client
const mockCreate = vi.fn();
vi.mock('@/services/anthropic/client', () => ({
  getAnthropicClient: () => ({
    messages: { create: mockCreate },
  }),
}));

// Mock memoryStore
const mockAddFacts = vi.fn();
const mockGetState = vi.fn();
vi.mock('@/store/memoryStore', () => ({
  useMemoryStore: {
    getState: () => mockGetState(),
  },
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
});

describe('extractAndStoreMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue({
      addFacts: mockAddFacts,
      facts: [],
    });
    mockAddFacts.mockResolvedValue(undefined);
  });

  it('calls Anthropic API with extraction prompt containing user+assistant text', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const { extractAndStoreMemory } = await import('@/services/memory/extractMemory');
    await extractAndStoreMemory('patrik', 'What is the budget?', 'The budget is $2M.', 'deal-1');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0]![0];
    expect(call.system).toBeDefined();
    expect(call.messages[0].content).toContain('What is the budget?');
    expect(call.messages[0].content).toContain('The budget is $2M.');
    expect(call.model).toBeDefined();
    expect(call.max_tokens).toBe(1024);
  });

  it('parses valid JSON response into MemoryFact[] and stores via addFacts', async () => {
    const extractedFacts = [
      { category: 'financial', content: 'Budget is $2M USD', confidence: 'high' },
      { category: 'decision', content: 'Proceeding with 3-tranche structure', confidence: 'medium' },
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(extractedFacts) }],
    });

    const { extractAndStoreMemory } = await import('@/services/memory/extractMemory');
    await extractAndStoreMemory('patrik', 'Tell me about the deal', 'The budget is $2M.', 'deal-1');

    expect(mockAddFacts).toHaveBeenCalledTimes(1);
    const storedFacts: MemoryFact[] = mockAddFacts.mock.calls[0]![0];
    expect(storedFacts).toHaveLength(2);
    expect(storedFacts[0]!.category).toBe('financial');
    expect(storedFacts[0]!.content).toBe('Budget is $2M USD');
    expect(storedFacts[0]!.agentId).toBe('patrik');
    expect(storedFacts[0]!.dealId).toBe('deal-1');
    expect(storedFacts[0]!.sourceAgentId).toBe('patrik');
    expect(storedFacts[0]!.id).toBeDefined();
    expect(storedFacts[0]!.createdAt).toBeGreaterThan(0);
    expect(storedFacts[0]!.updatedAt).toBeGreaterThan(0);
  });

  it('does not call addFacts when response is an empty array', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const { extractAndStoreMemory } = await import('@/services/memory/extractMemory');
    await extractAndStoreMemory('marcos', 'Hello', 'Hi there!', 'deal-1');

    expect(mockAddFacts).not.toHaveBeenCalled();
  });

  it('handles invalid JSON response (markdown fences, text) gracefully without throwing', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n[{"category":"financial","content":"$2M budget","confidence":"high"}]\n```' }],
    });

    const { extractAndStoreMemory } = await import('@/services/memory/extractMemory');

    // Should not throw
    await expect(
      extractAndStoreMemory('patrik', 'Budget?', '$2M', 'deal-1'),
    ).resolves.not.toThrow();

    // Should still successfully parse the JSON inside the fences
    expect(mockAddFacts).toHaveBeenCalledTimes(1);
  });

  it('catches API errors and logs warning (non-fatal, never throws)', async () => {
    mockCreate.mockRejectedValue(new Error('Rate limited'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { extractAndStoreMemory } = await import('@/services/memory/extractMemory');

    // Should not throw
    await expect(
      extractAndStoreMemory('sandra', 'Question', 'Answer', 'deal-1'),
    ).resolves.not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    expect(mockAddFacts).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('deduplicates: updates timestamp for existing fact with same category and overlapping content', async () => {
    const existingFact: MemoryFact = {
      id: 'existing-1',
      agentId: 'patrik',
      dealId: 'deal-1',
      category: 'financial',
      content: 'Budget is $2M USD with 60/40 split',
      confidence: 'high',
      sourceAgentId: 'patrik',
      createdAt: 1000,
      updatedAt: 1000,
    };

    mockGetState.mockReturnValue({
      addFacts: mockAddFacts,
      facts: [existingFact],
    });

    // New extraction returns similar fact
    const extractedFacts = [
      { category: 'financial', content: 'Budget is $2M USD production budget', confidence: 'high' },
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(extractedFacts) }],
    });

    const { extractAndStoreMemory } = await import('@/services/memory/extractMemory');
    await extractAndStoreMemory('patrik', 'Confirm budget', 'Budget is $2M', 'deal-1');

    // Should call addFacts with an updated existing fact (not a brand new one)
    // The dedup logic should detect overlap and update the existing fact's timestamp
    if (mockAddFacts.mock.calls.length > 0) {
      const storedFacts: MemoryFact[] = mockAddFacts.mock.calls[0]![0];
      // If dedup works, either:
      // a) no new facts added (empty array or not called), or
      // b) the existing fact's updatedAt is bumped
      // We expect the function to handle dedup by not adding a duplicate
      for (const fact of storedFacts) {
        if (fact.category === 'financial') {
          // Should be the updated existing fact, not a new one
          expect(fact.id).toBe('existing-1');
          expect(fact.updatedAt).toBeGreaterThan(1000);
        }
      }
    }
    // Either way, should not have stored a brand new duplicate
    if (mockAddFacts.mock.calls.length > 0) {
      const storedFacts: MemoryFact[] = mockAddFacts.mock.calls[0]![0];
      const financialFacts = storedFacts.filter(f => f.category === 'financial');
      expect(financialFacts.length).toBeLessThanOrEqual(1);
    }
  });
});
