import { create } from 'zustand';
import type { AgentId } from '@/types/agent';
import type {
  CollabChain,
  ChainSnapshot,
  ChainStatus,
  CollabHop,
  PendingHop,
} from '@/types/collaboration';
import { getPersistence } from '@/services/persistence/adapter';
import { useDealStore } from '@/store/dealStore';

/**
 * Module-scoped Set of AgentIds currently involved in a collaboration chain.
 * Used by canvas renderer and idleBehaviorManager — not Zustand state.
 * (Exported so plan 06 canvas renderer can read it without subscribing.)
 */
export const collaboratingAgents = new Set<AgentId>();

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface CollaborationState {
  activeChain: CollabChain | null;
  viewMode: 'live' | 'background';
  pendingHop: PendingHop | null;
  liveOutput: string;
  chainHistory: ChainSnapshot[];

  startChain: (originAgentId: AgentId, initialTask: string, dealName: string) => Promise<CollabChain>;
  setPendingHop: (pending: PendingHop | null) => void;
  approveHop: (chainId: string, hopIndex: number, injectedInstruction?: string, hop?: CollabHop) => void;
  skipHop: (chainId: string, hopIndex: number) => void;
  abortChain: (reason: string) => void;
  completeHop: (chainId: string, hopIndex: number, result: string, tokensUsed: number) => void;
  completeChain: (summary: string) => void;
  updateLiveOutput: (content: string) => void;
  clearLiveOutput: () => void;
  setViewMode: (mode: 'live' | 'background') => void;
  loadActiveChain: () => Promise<void>;
  loadChainHistory: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper: strip AbortController before persisting
// ---------------------------------------------------------------------------

function toSnapshot(chain: CollabChain): ChainSnapshot {
  const { abortController: _ac, ...snapshot } = chain;
  return snapshot;
}

async function persistChain(chain: CollabChain): Promise<void> {
  const persistence = getPersistence();
  await persistence.set('collaborations', chain.id, toSnapshot(chain));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  activeChain: null,
  viewMode: 'live',
  pendingHop: null,
  liveOutput: '',
  chainHistory: [],

  // -------------------------------------------------------------------------
  // startChain — create deal first, then build the chain
  // -------------------------------------------------------------------------
  startChain: async (originAgentId, initialTask, dealName) => {
    const dealId = await useDealStore.getState().createDeal(dealName);

    const now = Date.now();
    const chain: CollabChain = {
      id: crypto.randomUUID(),
      dealId,
      originAgentId,
      initialTask,
      hops: [],
      status: 'awaiting-approval' as ChainStatus,
      tokenBudgetUsed: 0,
      tokenBudgetLimit: 50_000,
      maxHops: 8,
      startedAt: now,
      viewMode: 'live',
      abortController: new AbortController(),
    };

    collaboratingAgents.add(originAgentId);
    await persistChain(chain);
    set({ activeChain: chain });
    return chain;
  },

  // -------------------------------------------------------------------------
  // setPendingHop — called by chainRunner when tool_use signal detected
  // -------------------------------------------------------------------------
  setPendingHop: (pending) => set({ pendingHop: pending }),

  // -------------------------------------------------------------------------
  // approveHop — register + approve hop; chain moves to 'walking'
  //
  // The `hop` parameter is required when the hop hasn't been added to the
  // chain yet (first call from chainRunner). approveHop upserts: if a hop
  // with `hopIndex` already exists it updates it; otherwise it appends the
  // new hop. This prevents the silent no-op that occurred when map() found
  // nothing because hops was empty.
  // -------------------------------------------------------------------------
  approveHop: (chainId, hopIndex, injectedInstruction, hop) => {
    const { activeChain } = get();
    if (!activeChain || activeChain.id !== chainId) return;

    // Determine the base hops list: upsert the incoming hop if provided
    let baseHops: CollabHop[];
    if (hop) {
      const exists = activeChain.hops.some(h => h.hopIndex === hopIndex);
      baseHops = exists
        ? activeChain.hops.map(h => (h.hopIndex === hopIndex ? { ...hop } : h))
        : [...activeChain.hops, { ...hop }];
    } else {
      baseHops = activeChain.hops;
    }

    const updatedHops = baseHops.map((h): CollabHop =>
      h.hopIndex === hopIndex ? { ...h, status: 'approved' } : h,
    );

    // If injectedInstruction provided, it will be picked up by chainRunner
    // via pendingHop.lastHopSummary — stored on the hop reason field if needed
    const chain: CollabChain = {
      ...activeChain,
      hops: updatedHops,
      status: 'walking',
      // Store injected instruction as part of hop reason if provided
      ...(injectedInstruction !== undefined
        ? {
            hops: updatedHops.map((h): CollabHop =>
              h.hopIndex === hopIndex
                ? { ...h, reason: injectedInstruction ? `${h.reason} [User: ${injectedInstruction}]` : h.reason }
                : h,
            ),
          }
        : {}),
    };

    set({ activeChain: chain, pendingHop: null });
    void persistChain(chain);
  },

  // -------------------------------------------------------------------------
  // skipHop — mark hop skipped, advance or complete
  // -------------------------------------------------------------------------
  skipHop: (chainId, hopIndex) => {
    const { activeChain } = get();
    if (!activeChain || activeChain.id !== chainId) return;

    const updatedHops = activeChain.hops.map((h): CollabHop =>
      h.hopIndex === hopIndex ? { ...h, status: 'skipped' } : h,
    );

    // Check if this was the last hop
    const remainingHops = updatedHops.filter(h => h.status === 'pending');
    const newStatus: ChainStatus = remainingHops.length === 0 ? 'completed' : 'walking';

    const chain: CollabChain = {
      ...activeChain,
      hops: updatedHops,
      status: newStatus,
      ...(newStatus === 'completed' ? { completedAt: Date.now() } : {}),
    };

    set({ activeChain: chain, pendingHop: null });
    void persistChain(chain);
  },

  // -------------------------------------------------------------------------
  // abortChain — abort, preserve completed hops
  // -------------------------------------------------------------------------
  abortChain: (reason) => {
    const { activeChain, chainHistory } = get();
    if (!activeChain) return;

    activeChain.abortController.abort(reason);

    const chain: CollabChain = {
      ...activeChain,
      status: 'aborted',
      completedAt: Date.now(),
      summary: `Aborted: ${reason}`,
    };

    // Remove from collaborating agents set
    collaboratingAgents.delete(activeChain.originAgentId);

    set({ activeChain: chain, pendingHop: null, chainHistory: [toSnapshot(chain), ...chainHistory] });
    void persistChain(chain);
  },

  // -------------------------------------------------------------------------
  // completeHop — mark hop completed, accumulate tokens
  // -------------------------------------------------------------------------
  completeHop: (chainId, hopIndex, result, tokensUsed) => {
    const { activeChain } = get();
    if (!activeChain || activeChain.id !== chainId) return;

    const updatedHops = activeChain.hops.map((h): CollabHop =>
      h.hopIndex === hopIndex
        ? { ...h, status: 'completed', result, actualTokensUsed: tokensUsed }
        : h,
    );

    const chain: CollabChain = {
      ...activeChain,
      hops: updatedHops,
      tokenBudgetUsed: activeChain.tokenBudgetUsed + tokensUsed,
      status: 'walking',
    };

    set({ activeChain: chain });
    void persistChain(chain);
  },

  // -------------------------------------------------------------------------
  // completeChain — finalize chain
  // -------------------------------------------------------------------------
  completeChain: (summary) => {
    const { activeChain, chainHistory } = get();
    if (!activeChain) return;

    const chain: CollabChain = {
      ...activeChain,
      status: 'completed',
      completedAt: Date.now(),
      summary,
    };

    collaboratingAgents.delete(activeChain.originAgentId);

    set({ activeChain: chain, chainHistory: [toSnapshot(chain), ...chainHistory] });
    void persistChain(chain);
  },

  // -------------------------------------------------------------------------
  // updateLiveOutput / clearLiveOutput — for streaming display
  // -------------------------------------------------------------------------
  updateLiveOutput: (content) => set({ liveOutput: content }),
  clearLiveOutput: () => set({ liveOutput: '' }),

  // -------------------------------------------------------------------------
  // setViewMode
  // -------------------------------------------------------------------------
  setViewMode: (mode) => set({ viewMode: mode }),

  // -------------------------------------------------------------------------
  // loadActiveChain — reconstruct most recent non-terminal chain on app init
  // -------------------------------------------------------------------------
  loadActiveChain: async () => {
    const persistence = getPersistence();

    // Query all non-completed/non-aborted snapshots
    const walkingChains = await persistence.query<ChainSnapshot>('collaborations', 'status', 'walking');
    const runningChains = await persistence.query<ChainSnapshot>('collaborations', 'status', 'running-hop');
    const awaitingChains = await persistence.query<ChainSnapshot>('collaborations', 'status', 'awaiting-approval');

    const candidates = [...walkingChains, ...runningChains, ...awaitingChains];
    if (candidates.length === 0) return;

    // Take most recent by startedAt
    const mostRecent = candidates.reduce((best, curr) =>
      curr.startedAt > best.startedAt ? curr : best,
    );

    // Reconstruct with fresh AbortController (runtime-only)
    const chain: CollabChain = {
      ...mostRecent,
      abortController: new AbortController(),
    };

    collaboratingAgents.add(chain.originAgentId);
    set({ activeChain: chain });
  },

  // -------------------------------------------------------------------------
  // loadChainHistory — load all terminal chains from IndexedDB for history view
  // -------------------------------------------------------------------------
  loadChainHistory: async () => {
    const persistence = getPersistence();
    const completed = await persistence.query<ChainSnapshot>('collaborations', 'status', 'completed');
    const aborted = await persistence.query<ChainSnapshot>('collaborations', 'status', 'aborted');
    const errored = await persistence.query<ChainSnapshot>('collaborations', 'status', 'error');

    const all = [...completed, ...aborted, ...errored];
    all.sort((a, b) => b.startedAt - a.startedAt);
    set({ chainHistory: all });
  },
}));
