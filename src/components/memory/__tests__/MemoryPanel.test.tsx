import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryPanel } from '../MemoryPanel';
import { useMemoryStore } from '@/store/memoryStore';
import type { MemoryFact } from '@/types/memory';

// Mock useDealStore
vi.mock('@/store/dealStore', () => {
  const store = {
    activeDealId: 'deal-1',
    deals: [],
    addDeal: vi.fn(),
    switchDeal: vi.fn(),
    loadDeals: vi.fn(),
  };
  const useDealStore = Object.assign(
    (selector?: (s: typeof store) => unknown) => selector ? selector(store) : store,
    { getState: () => store },
  );
  return { useDealStore };
});

// Mock memoryStore
vi.mock('@/store/memoryStore', () => {
  const facts: MemoryFact[] = [];
  const removeFact = vi.fn();
  const store = {
    facts,
    isExtracting: false,
    removeFact,
    loadFacts: vi.fn(),
    addFacts: vi.fn(),
    getFactsForAgent: vi.fn(() => []),
    getFactsForDeal: vi.fn(() => []),
    setExtracting: vi.fn(),
  };
  const useMemoryStore = Object.assign(
    (selector?: (s: typeof store) => unknown) => selector ? selector(store) : store,
    { getState: () => store },
  );
  return { useMemoryStore };
});

// Mock agents
vi.mock('@/config/agents', () => ({
  getAgent: (id: string) => {
    if (id === 'patrik') return { name: 'Patrik', title: 'VP of M&A', color: '#e8b931' };
    return undefined;
  },
}));

const NOW = Date.now();

const TEST_FACTS: MemoryFact[] = [
  {
    id: 'fact-1',
    agentId: 'patrik',
    dealId: 'deal-1',
    category: 'financial',
    content: 'Budget is $2.4M USD',
    confidence: 'high',
    sourceAgentId: 'patrik',
    createdAt: NOW - 120_000, // 2 min ago
    updatedAt: NOW - 120_000,
  },
  {
    id: 'fact-2',
    agentId: 'patrik',
    dealId: 'deal-1',
    category: 'financial',
    content: 'EFICINE tax credit is 35%',
    confidence: 'medium',
    sourceAgentId: 'patrik',
    createdAt: NOW - 60_000, // 1 min ago
    updatedAt: NOW - 60_000,
  },
  {
    id: 'fact-3',
    agentId: 'patrik',
    dealId: 'deal-1',
    category: 'date',
    content: 'Principal photography starts June 15',
    confidence: 'low',
    sourceAgentId: 'marcos',
    createdAt: NOW - 3600_000, // 1 hr ago
    updatedAt: NOW - 3600_000,
  },
  {
    id: 'fact-4',
    agentId: 'patrik',
    dealId: 'deal-1',
    category: 'decision',
    content: 'Proceed with 3-tranche waterfall',
    confidence: 'high',
    sourceAgentId: 'patrik',
    createdAt: NOW - 7200_000, // 2 hr ago
    updatedAt: NOW - 7200_000,
  },
];

function setupFacts(facts: MemoryFact[]) {
  const store = useMemoryStore.getState() as ReturnType<typeof useMemoryStore.getState>;
  store.facts.length = 0;
  facts.forEach((f) => store.facts.push(f));
  (store.removeFact as ReturnType<typeof vi.fn>).mockClear();
}

describe('MemoryPanel', () => {
  beforeEach(() => {
    cleanup();
    setupFacts(TEST_FACTS);
  });

  it('renders facts grouped by category with category headers', () => {
    render(<MemoryPanel agentId="patrik" onClose={vi.fn()} />);

    // Should have category headers for financial, date, decision
    expect(screen.getByText(/financial/i)).toBeTruthy();
    expect(screen.getByText(/date/i)).toBeTruthy();
    expect(screen.getByText(/decision/i)).toBeTruthy();

    // All 4 facts should be rendered
    expect(screen.getByText('Budget is $2.4M USD')).toBeTruthy();
    expect(screen.getByText('EFICINE tax credit is 35%')).toBeTruthy();
    expect(screen.getByText('Principal photography starts June 15')).toBeTruthy();
    expect(screen.getByText('Proceed with 3-tranche waterfall')).toBeTruthy();
  });

  it('shows confidence badges with correct colors (high=green, medium=amber, low=red)', () => {
    render(<MemoryPanel agentId="patrik" onClose={vi.fn()} />);

    // Find all confidence badges
    const highBadges = screen.getAllByText('high');
    const mediumBadges = screen.getAllByText('medium');
    const lowBadges = screen.getAllByText('low');

    // Verify counts
    expect(highBadges).toHaveLength(2); // fact-1 and fact-4
    expect(mediumBadges).toHaveLength(1); // fact-2
    expect(lowBadges).toHaveLength(1); // fact-3

    // Verify badge colors via class names
    expect(highBadges[0]!.className).toContain('green');
    expect(mediumBadges[0]!.className).toContain('amber');
    expect(lowBadges[0]!.className).toContain('red');
  });

  it('delete button calls memoryStore.removeFact with fact id', () => {
    render(<MemoryPanel agentId="patrik" onClose={vi.fn()} />);

    // Find delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Click the first delete button
    fireEvent.click(deleteButtons[0]!);

    const store = useMemoryStore.getState();
    expect(store.removeFact).toHaveBeenCalledWith('fact-1');
  });

  it('close button calls onClose callback', () => {
    const onClose = vi.fn();
    render(<MemoryPanel agentId="patrik" onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows "No memories yet" message when there are no facts', () => {
    setupFacts([]);
    render(<MemoryPanel agentId="patrik" onClose={vi.fn()} />);

    // Verify empty state includes message with agent name
    expect(screen.getByText(/no memories yet/i)).toBeTruthy();
  });
});
