import { describe, it, expect } from 'vitest';
import { checkSafetyLimits, COLLAB_SAFETY } from '@/services/collaboration/safetyLimits';

function makeChain(overrides: Partial<{
  completedHops: number;
  tokenBudgetUsed: number;
  startedAt: number;
}> = {}) {
  const completedHops = overrides.completedHops ?? 0;
  return {
    hops: Array.from({ length: completedHops }, (_, i) => ({ status: 'completed' as const, hopIndex: i })) as any,
    tokenBudgetUsed: overrides.tokenBudgetUsed ?? 0,
    tokenBudgetLimit: COLLAB_SAFETY.TOKEN_BUDGET,
    maxHops: COLLAB_SAFETY.MAX_HOPS,
    startedAt: overrides.startedAt ?? Date.now(),
  };
}

describe('safetyLimits (COLLAB-04, COLLAB-09)', () => {
  it('checkSafetyLimits returns ok=true when chain is within all limits', () => {
    const chain = makeChain({ completedHops: 3, tokenBudgetUsed: 10_000 });
    const result = checkSafetyLimits(chain);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('COLLAB_SAFETY constants match spec', () => {
    expect(COLLAB_SAFETY.MAX_HOPS).toBe(8);
    expect(COLLAB_SAFETY.TOKEN_BUDGET).toBe(50_000);
    expect(COLLAB_SAFETY.TIMEOUT_MS).toBe(300_000);
  });

  it('returns ok=false with reason when completed hop count >= MAX_HOPS', () => {
    const chain = makeChain({ completedHops: COLLAB_SAFETY.MAX_HOPS }); // exactly at limit
    const result = checkSafetyLimits(chain);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Max chain length reached');
  });

  it('returns ok=false with reason when tokenBudgetUsed >= TOKEN_BUDGET', () => {
    const chain = makeChain({ tokenBudgetUsed: COLLAB_SAFETY.TOKEN_BUDGET }); // exactly at limit
    const result = checkSafetyLimits(chain);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Token budget exhausted');
  });

  it('returns ok=false with reason when elapsed time >= TIMEOUT_MS', () => {
    // Set startedAt far in the past so elapsed >= TIMEOUT_MS
    const startedAt = Date.now() - COLLAB_SAFETY.TIMEOUT_MS - 1000;
    const chain = makeChain({ startedAt });
    const result = checkSafetyLimits(chain);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Collaboration timed out');
  });
});
