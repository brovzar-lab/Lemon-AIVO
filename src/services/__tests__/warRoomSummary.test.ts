import { describe, it, expect, vi } from 'vitest';
import { buildCrossVisibilityBlock } from '../context/warRoomSummary';

// Mock the agents config
vi.mock('@/config/agents', () => ({
  getAgent: (id: string) => {
    const agents: Record<string, { name: string; title: string }> = {
      patrik: { name: 'Patrik', title: 'CFO' },
      marcos: { name: 'Marcos', title: 'Legal Counsel' },
      sandra: { name: 'Sandra', title: 'Head of Deals' },
      isaac: { name: 'Isaac', title: 'Head of Accounting' },
      wendy: { name: 'Wendy', title: 'Head of Development' },
    };
    return agents[id] ?? undefined;
  },
}));

describe('buildCrossVisibilityBlock', () => {
  it('returns summary string excluding the current agent own response', () => {
    const responses: Record<string, string> = {
      patrik: 'Patrik says something about cash flow projections.',
      marcos: 'Marcos has legal opinions about the contract terms.',
      sandra: 'Sandra discusses deal structure and valuation.',
    };

    const result = buildCrossVisibilityBlock('patrik', responses);

    // Should NOT contain Patrik's response
    expect(result).not.toContain('Patrik says something');
    // Should contain Marcos and Sandra
    expect(result).toContain('Marcos');
    expect(result).toContain('Sandra');
    expect(result).toContain('[War Room Context');
  });

  it('includes other agents truncated responses (max ~160 chars each)', () => {
    const longResponse = 'A'.repeat(250); // 250 chars, should be truncated
    const responses: Record<string, string> = {
      patrik: 'Short response.',
      marcos: longResponse,
    };

    const result = buildCrossVisibilityBlock('patrik', responses);

    // Marcos's response should be truncated to ~160 chars + ellipsis
    expect(result).toContain('A'.repeat(160));
    expect(result).toContain('...');
    // Should NOT contain the full 250 chars
    expect(result).not.toContain('A'.repeat(200));
  });

  it('returns empty string when no responses exist', () => {
    const result = buildCrossVisibilityBlock('patrik', {});

    expect(result).toBe('');
  });

  it('returns empty string when only the current agent has a response', () => {
    const responses: Record<string, string> = {
      patrik: 'Only Patrik responded.',
    };

    const result = buildCrossVisibilityBlock('patrik', responses);

    expect(result).toBe('');
  });

  it('does not add ellipsis for short responses', () => {
    const responses: Record<string, string> = {
      patrik: 'Short.',
      marcos: 'Also short.',
    };

    const result = buildCrossVisibilityBlock('patrik', responses);

    expect(result).toContain('Also short.');
    // Should NOT have trailing ellipsis for short text
    expect(result).not.toContain('Also short....');
  });
});
