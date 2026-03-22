import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Deal } from '@/types/deal';
import type { FileRecord } from '@/types/file';
import type { MessageRole } from '@/types/chat';

// Mock state
let mockActiveDealId: string | null = 'deal-1';
let mockDeals: Deal[] = [
  { id: 'deal-1', name: 'Test Deal', status: 'active', createdAt: 1000, updatedAt: 1000 },
];
let mockFiles: FileRecord[] = [];

vi.mock('@/store/dealStore', () => ({
  useDealStore: {
    getState: () => ({
      activeDealId: mockActiveDealId,
      deals: mockDeals,
    }),
  },
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      files: mockFiles,
    }),
  },
}));

vi.mock('@/config/agents', () => ({
  getAgent: (id: string) => ({
    name: id.charAt(0).toUpperCase() + id.slice(1),
    personaPrompt: `You are ${id}, a trusted advisor.`,
  }),
}));

import { buildContext } from '../builder';

describe('buildContext Layer 4 file injection', () => {
  const messages: Array<{ role: MessageRole; content: string }> = [
    { role: 'user', content: 'Review this document.' },
  ];

  beforeEach(() => {
    mockActiveDealId = 'deal-1';
    mockDeals = [
      { id: 'deal-1', name: 'Test Deal', status: 'active', createdAt: 1000, updatedAt: 1000 },
    ];
    mockFiles = [];
  });

  it('includes "## Uploaded Documents" section when agent has files', () => {
    mockFiles = [
      {
        id: 'f1',
        name: 'contract.pdf',
        size: 1000,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'This is the contract text.',
        uploadedAt: Date.now(),
      },
    ];

    const result = buildContext('patrik', messages);
    expect(result.systemPrompt).toContain('## Uploaded Documents');
    expect(result.systemPrompt).toContain('### contract.pdf');
    expect(result.systemPrompt).toContain('This is the contract text.');
  });

  it('does NOT include file content when agent has no files (backward compatible)', () => {
    mockFiles = [];

    const result = buildContext('patrik', messages);
    expect(result.systemPrompt).not.toContain('Uploaded Documents');
  });

  it('does NOT include files belonging to another agent', () => {
    mockFiles = [
      {
        id: 'f1',
        name: 'contract.pdf',
        size: 1000,
        type: 'pdf',
        agentId: 'marcos',
        dealId: 'deal-1',
        extractedText: 'Marcos only text.',
        uploadedAt: Date.now(),
      },
    ];

    const result = buildContext('patrik', messages);
    expect(result.systemPrompt).not.toContain('Uploaded Documents');
    expect(result.systemPrompt).not.toContain('Marcos only text.');
  });

  it('does NOT include files from a different deal', () => {
    mockFiles = [
      {
        id: 'f1',
        name: 'contract.pdf',
        size: 1000,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-other',
        extractedText: 'Wrong deal text.',
        uploadedAt: Date.now(),
      },
    ];

    const result = buildContext('patrik', messages);
    expect(result.systemPrompt).not.toContain('Uploaded Documents');
  });

  it('truncates per-file text at ~8000 chars with truncation marker', () => {
    const longText = 'A'.repeat(10000);
    mockFiles = [
      {
        id: 'f1',
        name: 'big.pdf',
        size: 50000,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: longText,
        uploadedAt: Date.now(),
      },
    ];

    const result = buildContext('patrik', messages);
    expect(result.systemPrompt).toContain('### big.pdf');
    // Should have truncation marker
    expect(result.systemPrompt).toContain('[... truncated');
    // The text portion in the prompt should be at most ~8000 chars of original + marker
    const fileSection = result.systemPrompt.split('### big.pdf')[1]!;
    // Original text should be truncated (not all 10000 chars)
    const aCount = (fileSection.match(/A/g) || []).length;
    expect(aCount).toBeLessThanOrEqual(8000);
  });

  it('respects total token cap - skips files beyond budget', () => {
    // Each file uses 7000 chars = 1750 tokens after per-file truncation is not needed
    // Two files = 3500 tokens, fits. Five files would be 8750 tokens, exceeds 8000 cap.
    // So the 5th file should be excluded.
    const text = 'B'.repeat(7000); // 1750 tokens each, 4 files = 7000, 5th = 8750 > 8000
    mockFiles = [];
    for (let i = 1; i <= 6; i++) {
      mockFiles.push({
        id: `f${i}`,
        name: `doc${i}.pdf`,
        size: 1000,
        type: 'pdf' as const,
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: text,
        uploadedAt: i * 1000,
      });
    }

    const result = buildContext('patrik', messages);
    // First 4 files fit (4 * 1750 = 7000 tokens), 5th would push to 8750 > 8000
    expect(result.systemPrompt).toContain('### doc1.pdf');
    expect(result.systemPrompt).toContain('### doc4.pdf');
    expect(result.systemPrompt).not.toContain('### doc5.pdf');
    expect(result.systemPrompt).not.toContain('### doc6.pdf');
  });

  it('Layer 4 appears after Layer 3 (deal context) in system prompt', () => {
    mockFiles = [
      {
        id: 'f1',
        name: 'contract.pdf',
        size: 1000,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'Contract text here.',
        uploadedAt: Date.now(),
      },
    ];

    const result = buildContext('patrik', messages);
    const dealIdx = result.systemPrompt.indexOf('Test Deal');
    const fileIdx = result.systemPrompt.indexOf('## Uploaded Documents');
    expect(dealIdx).toBeGreaterThan(-1);
    expect(fileIdx).toBeGreaterThan(-1);
    expect(dealIdx).toBeLessThan(fileIdx);
  });
});
