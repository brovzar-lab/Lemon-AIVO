import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Deal } from '@/types/deal';
import type { MessageRole } from '@/types/chat';

// Mock dealStore
let mockActiveDealId: string | null = null;
let mockDeals: Deal[] = [];

vi.mock('@/store/dealStore', () => ({
  useDealStore: {
    getState: () => ({
      activeDealId: mockActiveDealId,
      deals: mockDeals,
    }),
  },
}));

// Mock getAgent to return a basic persona config
vi.mock('@/config/agents', () => ({
  getAgent: (id: string) => ({
    name: id.charAt(0).toUpperCase() + id.slice(1),
    personaPrompt: `You are ${id}, a trusted advisor.`,
  }),
}));

import { buildContext } from '../builder';

describe('buildContext deal injection (Layer 3)', () => {
  const messages: Array<{ role: MessageRole; content: string }> = [
    { role: 'user', content: 'What do you think about this deal?' },
  ];

  beforeEach(() => {
    mockActiveDealId = null;
    mockDeals = [];
  });

  it('with active deal -> system prompt contains "currently advising on: <deal name>"', () => {
    mockActiveDealId = 'deal-1';
    mockDeals = [
      { id: 'deal-1', name: 'Oro Verde - Netflix', status: 'active', createdAt: 1000, updatedAt: 1000 },
    ];

    const result = buildContext('patrik', messages);

    expect(result.systemPrompt).toContain('Oro Verde - Netflix');
    expect(result.systemPrompt).toMatch(/currently advising on.*Oro Verde - Netflix/i);
  });

  it('with active deal + description -> system prompt contains deal description', () => {
    mockActiveDealId = 'deal-2';
    mockDeals = [
      { id: 'deal-2', name: 'Lemon Trust I', description: 'Netflix MX limited series, $2.4M budget', status: 'active', createdAt: 1000, updatedAt: 1000 },
    ];

    const result = buildContext('patrik', messages);

    expect(result.systemPrompt).toContain('Lemon Trust I');
    expect(result.systemPrompt).toContain('Netflix MX limited series, $2.4M budget');
  });

  it('with no active deal -> system prompt does NOT contain deal context', () => {
    mockActiveDealId = null;
    mockDeals = [];

    const result = buildContext('patrik', messages);

    expect(result.systemPrompt).not.toMatch(/currently advising on/i);
    expect(result.systemPrompt).not.toContain('Deal Creation Capability');
  });

  it('with deal context -> Layer 3 appears between Layer 2 (persona) and messages, not at the end of prompt', () => {
    mockActiveDealId = 'deal-1';
    mockDeals = [
      { id: 'deal-1', name: 'Test Deal', status: 'active', createdAt: 1000, updatedAt: 1000 },
    ];

    const result = buildContext('patrik', messages);
    const prompt = result.systemPrompt;

    // Persona (Layer 2) should appear before deal context (Layer 3)
    const personaIdx = prompt.indexOf('You are patrik, a trusted advisor.');
    const dealIdx = prompt.indexOf('Test Deal');
    expect(personaIdx).toBeGreaterThan(-1);
    expect(dealIdx).toBeGreaterThan(-1);
    expect(personaIdx).toBeLessThan(dealIdx);
  });

  it('existing Layer 1 (base) and Layer 2 (persona) still present in output', () => {
    mockActiveDealId = 'deal-1';
    mockDeals = [
      { id: 'deal-1', name: 'Test Deal', status: 'active', createdAt: 1000, updatedAt: 1000 },
    ];

    const result = buildContext('patrik', messages);

    // Layer 1: Base system prompt
    expect(result.systemPrompt).toContain('Lemon Studios');
    // Layer 2: Persona prompt
    expect(result.systemPrompt).toContain('You are patrik, a trusted advisor.');
  });

  it('crossVisibilityBlock still works alongside deal context', () => {
    mockActiveDealId = 'deal-1';
    mockDeals = [
      { id: 'deal-1', name: 'Test Deal', status: 'active', createdAt: 1000, updatedAt: 1000 },
    ];

    const crossBlock = 'Other agents said: Marcos thinks this is great.';
    const result = buildContext('patrik', messages, undefined, crossBlock);

    expect(result.systemPrompt).toContain(crossBlock);
    expect(result.systemPrompt).toContain('Test Deal');
  });
});
