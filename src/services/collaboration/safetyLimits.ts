import type { CollabChain } from '@/types/collaboration';

export const COLLAB_SAFETY = {
  MAX_HOPS: 8,
  TOKEN_BUDGET: 50_000,
  TIMEOUT_MS: 300_000,
  MAX_OUTPUT_TOKENS: 4096,
} as const;

/**
 * Checks hard safety limits before each hop fires.
 * Returns { ok: true } when all limits are within bounds.
 * Returns { ok: false, reason } when any limit is exceeded.
 */
export function checkSafetyLimits(
  chain: Pick<CollabChain, 'hops' | 'tokenBudgetUsed' | 'tokenBudgetLimit' | 'maxHops' | 'startedAt'>,
): { ok: boolean; reason?: string } {
  const completedHops = chain.hops.filter(h => h.status === 'completed').length;

  if (completedHops >= chain.maxHops) {
    return { ok: false, reason: 'Max chain length reached' };
  }

  if (chain.tokenBudgetUsed >= chain.tokenBudgetLimit) {
    return { ok: false, reason: 'Token budget exhausted' };
  }

  if (Date.now() - chain.startedAt >= COLLAB_SAFETY.TIMEOUT_MS) {
    return { ok: false, reason: 'Collaboration timed out' };
  }

  return { ok: true };
}
