import { describe, it, expect, vi } from 'vitest';
import type { MemoryFact } from '@/types/memory';
import type { Conversation } from '@/types/chat';

/**
 * Integration test proving MEM-05: memory facts are stored independently
 * of conversations and are not affected by summarization.
 *
 * The key insight: memory lives in the 'memory' IndexedDB store while
 * conversations live in the 'conversations' store. Summarization only
 * touches 'conversations'.
 */

// Track what gets written to which store
const persistenceWrites: Record<string, Map<string, unknown>> = {
  memory: new Map(),
  conversations: new Map(),
};

vi.mock('@/services/persistence/adapter', () => ({
  getPersistence: () => ({
    set: async (store: string, key: string, value: unknown) => {
      if (!persistenceWrites[store]) {
        persistenceWrites[store] = new Map();
      }
      persistenceWrites[store].set(key, value);
    },
    get: async (store: string, key: string) => {
      return persistenceWrites[store]?.get(key) ?? null;
    },
    query: async (store: string, _index: string, value: string) => {
      const storeData = persistenceWrites[store];
      if (!storeData) return [];
      const results: unknown[] = [];
      for (const v of storeData.values()) {
        if (v && typeof v === 'object' && 'dealId' in v && (v as { dealId: string }).dealId === value) {
          results.push(v);
        }
      }
      return results;
    },
    delete: async () => {},
  }),
}));

vi.mock('@/services/anthropic/client', () => ({
  getAnthropicClient: () => ({
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: 'Summary of conversation.' }],
      }),
    },
  }),
}));

import { summarizeConversation } from '@/services/context/summarizer';

describe('Memory survives summarization', () => {
  it('memory facts in IndexedDB are untouched after summarizeConversation runs', async () => {
    // 1. Populate memory store with facts
    const memoryFacts: MemoryFact[] = [
      {
        id: 'mem-1',
        agentId: 'patrik',
        dealId: 'deal-1',
        category: 'financial',
        content: 'Budget is $2.4M USD',
        confidence: 'high',
        sourceAgentId: 'patrik',
        createdAt: 1000,
        updatedAt: 2000,
      },
      {
        id: 'mem-2',
        agentId: 'marcos',
        dealId: 'deal-1',
        category: 'risk',
        content: 'Currency risk on MXN/USD',
        confidence: 'high',
        sourceAgentId: 'marcos',
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];

    // Simulate memory facts being stored
    for (const fact of memoryFacts) {
      await persistenceWrites.memory!.set(fact.id, fact);
    }

    // 2. Create a conversation that exceeds summarization threshold
    const conversation: Conversation = {
      id: 'conv-1',
      agentId: 'patrik',
      dealId: 'deal-1',
      messages: Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv-1',
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'A'.repeat(10000), // lots of content to trigger summarization
        timestamp: Date.now(),
      })),
      totalTokens: 200_000, // above 80% of 200K threshold
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 3. Run summarizeConversation
    await summarizeConversation(conversation, {
      onComplete: () => {
        // Summary was generated -- this is expected
      },
      onError: (err) => {
        throw err;
      },
    });

    // 4. Verify memory facts are completely untouched
    const fact1 = persistenceWrites.memory!.get('mem-1') as MemoryFact;
    const fact2 = persistenceWrites.memory!.get('mem-2') as MemoryFact;

    expect(fact1).toBeDefined();
    expect(fact1.content).toBe('Budget is $2.4M USD');
    expect(fact1.agentId).toBe('patrik');

    expect(fact2).toBeDefined();
    expect(fact2.content).toBe('Currency risk on MXN/USD');
    expect(fact2.agentId).toBe('marcos');

    // 5. Verify summarization only touched 'conversations' store
    expect(persistenceWrites.conversations!.size).toBeGreaterThan(0);

    // Memory store should still have exactly 2 facts, unchanged
    expect(persistenceWrites.memory!.size).toBe(2);
  });
});
