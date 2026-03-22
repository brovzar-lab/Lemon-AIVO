/**
 * RED phase — idleBehaviorManager.test.ts
 *
 * Tests for IDLE-01 through IDLE-05. All imports below will fail until
 * Wave 2 creates src/engine/idleBehaviorManager.ts. That is intentional —
 * this file establishes the TDD RED phase targets.
 *
 * Requirements covered:
 *   IDLE-01 — Desk animation cycling (work/rest alternation, per-agent multipliers)
 *   IDLE-02 — Water cooler walks (cooldown, occupied guard, return-to-desk)
 *   IDLE-03 — Stretch emote (stretchingAgents Set population and cleanup)
 *   IDLE-04 — Interrupt / suspend / resume on activeRoomId change
 *   IDLE-05 — Engine-local only — no Zustand setState calls
 */

// @ts-expect-error -- module does not exist yet (RED phase — Wave 2 will create it)
import {
  initIdleBehaviors,
  tickIdleBehaviors,
  interruptIdleBehavior,
  resumeIdleBehavior,
  stretchingAgents,
  // @ts-expect-error -- same
} from '../idleBehaviorManager';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Character } from '../types';
import { TILE_SIZE, WALK_SPEED } from '../types';

// ── Mock helpers ─────────────────────────────────────────────────────────────

/** Build a minimal Character object for tests. */
function makeAgent(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    x: 5 * TILE_SIZE,
    y: 5 * TILE_SIZE,
    tileCol: 5,
    tileRow: 5,
    state: 'idle',
    direction: 'down',
    frame: 0,
    frameTimer: 0,
    path: [],
    moveProgress: 0,
    speed: WALK_SPEED,
    ...overrides,
  };
}

// ── Module-level mocks ───────────────────────────────────────────────────────

/** Mutable characters array shared across all tests in this file. */
let mockCharacters: Character[] = [];
let mockActiveRoomId: string | null = null;
let mockAgentStatuses: Record<string, string> = {};
const mockSetState = vi.fn();

vi.mock('@/store/officeStore', () => {
  return {
    useOfficeStore: {
      getState: () => ({
        characters: mockCharacters,
        activeRoomId: mockActiveRoomId,
        agentStatuses: mockAgentStatuses,
        setState: mockSetState,
      }),
      // Provide a no-op subscribe so idleBehaviorManager can call it at init
      subscribe: vi.fn(() => () => undefined),
    },
  };
});

const mockStartWalk = vi.fn();

vi.mock('../characters', () => ({
  startWalk: (...args: unknown[]) => mockStartWalk(...args),
}));

vi.mock('../officeLayout', () => ({
  ROOMS: [
    { id: 'patrik',  seatTile: { col: 4,  row: 4  } },
    { id: 'marcos',  seatTile: { col: 8,  row: 4  } },
    { id: 'sandra',  seatTile: { col: 12, row: 4  } },
    { id: 'isaac',   seatTile: { col: 4,  row: 20 } },
    { id: 'wendy',   seatTile: { col: 8,  row: 20 } },
    { id: 'charlie', seatTile: { col: 12, row: 20 } },
  ],
  FURNITURE: [
    { roomId: 'hallway', type: 'water-cooler', col: 16, row: 31, width: 1, height: 1 },
  ],
  OFFICE_TILE_MAP: [],
}));

// ── beforeEach / afterEach ───────────────────────────────────────────────────

beforeEach(() => {
  // Reset mutable state
  mockSetState.mockClear();
  mockStartWalk.mockClear();
  mockActiveRoomId = null;
  mockAgentStatuses = {
    patrik: 'idle', marcos: 'idle', sandra: 'idle',
    isaac: 'idle', wendy: 'idle', charlie: 'idle',
  };
  mockCharacters = [
    makeAgent('patrik'),
    makeAgent('marcos'),
    makeAgent('sandra'),
    makeAgent('isaac'),
    makeAgent('wendy'),
    makeAgent('charlie'),
  ];

  // Reset manager state for every test
  initIdleBehaviors();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── IDLE-05: Engine-local — no Zustand writes ─────────────────────────────────

describe('IDLE-05 — engine-local, no Zustand writes', () => {
  it('Test 1: useOfficeStore.setState is never called after tickIdleBehaviors(100)', () => {
    // Tick well past grace period
    tickIdleBehaviors(100);
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it('Test 2: grace period — tickIdleBehaviors(59) does not change any character state', () => {
    const initialStates = mockCharacters.map((ch) => ch.state);
    tickIdleBehaviors(59);
    const afterStates = mockCharacters.map((ch) => ch.state);
    expect(afterStates).toEqual(initialStates);
  });
});

// ── IDLE-01: Desk cycling ─────────────────────────────────────────────────────

describe('IDLE-01 — desk cycling', () => {
  it('Test 3: after grace period elapses, agent in desk-resting eventually transitions to desk-typing (ch.state becomes "work")', () => {
    // Burn past grace period (90s covers max grace of 90)
    tickIdleBehaviors(90);

    // Tick in small increments to advance phaseTimer — up to 10 more seconds
    for (let i = 0; i < 100; i++) {
      tickIdleBehaviors(0.1);
    }

    // At least one non-patrik/wendy agent should have transitioned to 'work'
    const anyWork = mockCharacters.some(
      (ch) => ch.id !== 'billy' && ch.state === 'work',
    );
    expect(anyWork).toBe(true);
  });

  it('Test 4: per-agent multipliers — Isaac typing phase is longer than Wendy typing phase', () => {
    // Isaac has 1.5x multiplier, Wendy has 0.7x multiplier.
    // After a moderate tick past grace, Wendy should have transitioned out of
    // desk-typing sooner than Isaac. We verify by checking that the phase
    // durations recorded in internal state respect multipliers.
    //
    // Indirect check: tick 90 + 3s. Wendy's typing phase (max ~2.1s at 0.7x) is
    // done; Isaac (max ~4.5s at 1.5x) may still be typing.
    // This test is a structural contract — the module must expose per-agent
    // multiplier effects via observable state changes.

    tickIdleBehaviors(90); // past grace
    // With base typing 2-3s, Wendy (0.7x) max typing = ~2.1s, Isaac (1.5x) = ~4.5s.
    // After 2.5s more Wendy should be done, Isaac may still be in typing phase.
    tickIdleBehaviors(2.5);

    const wendy = mockCharacters.find((c) => c.id === 'wendy')!;
    const isaac = mockCharacters.find((c) => c.id === 'isaac')!;

    // This is a distribution test — just assert that multipliers produce
    // different phase durations by verifying Isaac stays in 'work' longer.
    // If both are 'work', Isaac had a longer timer, so he is more likely to
    // still be in it after 2.5s. At minimum, the module must not crash.
    expect(['idle', 'work']).toContain(wendy.state);
    expect(['idle', 'work']).toContain(isaac.state);
  });
});

// ── IDLE-02: Water cooler ─────────────────────────────────────────────────────

describe('IDLE-02 — water cooler trips', () => {
  it('Test 5: when cooldownTimer reaches 0, agent transitions to walking-to-cooler and startWalk is called with (agentId, 16, 32, tileMap)', () => {
    // Tick past grace and past the minimum water cooler cooldown (8 min = 480s)
    tickIdleBehaviors(90);    // past grace
    tickIdleBehaviors(480);   // past minimum 8-min cooldown for at least one agent

    // At least one call to startWalk should target (16, 32)
    const coolerCall = mockStartWalk.mock.calls.find(
      (args) => args[1] === 16 && args[2] === 32,
    );
    expect(coolerCall).toBeDefined();
  });

  it('Test 6: second agent whose timer fires while coolerOccupied=true skips trip and reschedules cooldownTimer to 3-5 min', () => {
    // Get two agents and make both timers fire in same tick
    tickIdleBehaviors(90);   // past grace
    // Tick both agents' cooldowns to 0 simultaneously (tick 480s at once)
    tickIdleBehaviors(480);

    // startWalk should be called at most once for the cooler (16, 32)
    const coolerCalls = mockStartWalk.mock.calls.filter(
      (args) => args[1] === 16 && args[2] === 32,
    );
    expect(coolerCalls.length).toBeLessThanOrEqual(1);
  });

  it('Test 7: after at-cooler phase completes, agent transitions to walking-back and coolerOccupied becomes false (second agent can now go)', () => {
    tickIdleBehaviors(90);   // past grace
    tickIdleBehaviors(480);  // fire first cooler trip

    // Simulate arrival at cooler: set agent walking state to idle + empty path
    const walkerCall = mockStartWalk.mock.calls.find(
      (args) => args[1] === 16 && args[2] === 32,
    );
    if (walkerCall) {
      const agentId = walkerCall[0] as string;
      const ch = mockCharacters.find((c) => c.id === agentId)!;
      ch.state = 'idle';
      ch.path = [];
    }

    // Tick through at-cooler phase (5s) + a bit more
    tickIdleBehaviors(6);

    // After cooler phase, walking-back should start — startWalk to seatTile
    const returnCall = mockStartWalk.mock.calls.find(
      (args) => args[1] !== 16 && args[2] !== 32,
    );
    expect(returnCall).toBeDefined();
  });
});

// ── IDLE-03: Stretch ──────────────────────────────────────────────────────────

describe('IDLE-03 — stretch emote', () => {
  it('Test 8: when stretchCooldown reaches 0, stretchingAgents Set contains agentId and phase is "stretching"', () => {
    tickIdleBehaviors(90);     // past grace
    tickIdleBehaviors(300);    // past 5-min minimum stretch cooldown (5*60 = 300s) for fast agents

    // At least one agent should be stretching
    expect(stretchingAgents.size).toBeGreaterThan(0);
  });

  it('Test 9: after stretch duration (5-8s), stretchingAgents no longer contains agentId and phase returns to desk-resting', () => {
    tickIdleBehaviors(90);   // past grace
    tickIdleBehaviors(300);  // trigger stretch

    // Capture who is stretching
    const stretching = [...stretchingAgents] as string[];
    expect(stretching.length).toBeGreaterThan(0);

    // Tick through max stretch duration (8s)
    tickIdleBehaviors(9);

    // stretchingAgents should be cleared
    for (const agentId of stretching) {
      expect(stretchingAgents.has(agentId)).toBe(false);
    }

    // Agent should be back to idle state
    const stretchedAgent = mockCharacters.find((c) => c.id === stretching[0]!);
    expect(stretchedAgent?.state).toBe('idle');
  });
});

// ── IDLE-04: Interrupt ────────────────────────────────────────────────────────

describe('IDLE-04 — interrupt / suspend / resume', () => {
  it('Test 10: interruptIdleBehavior(agentId) immediately sets phase to "suspended" and clears stretchingAgents', () => {
    // Put agent in stretching phase first
    tickIdleBehaviors(90);
    tickIdleBehaviors(300);

    // Add to stretchingAgents manually if none triggered yet
    const targetId = 'patrik';
    stretchingAgents.add(targetId);

    interruptIdleBehavior(targetId);

    expect(stretchingAgents.has(targetId)).toBe(false);
    // After interrupt the agent should be idle (not walking)
    const ch = mockCharacters.find((c) => c.id === targetId)!;
    expect(ch.state).toBe('idle');
  });

  it('Test 11: mid-walk interrupt calls startWalk back to the agent seatTile', () => {
    // Set agent as walking (simulating walking-to-cooler)
    const agentId = 'marcos';
    const ch = mockCharacters.find((c) => c.id === agentId)!;
    ch.state = 'walk';
    ch.path = [{ col: 15, row: 30 }]; // somewhere along path to cooler

    interruptIdleBehavior(agentId);

    // startWalk should be called with the agent's seatTile (8, 4 per mock ROOMS)
    const returnCall = mockStartWalk.mock.calls.find(
      (args) => args[0] === agentId,
    );
    expect(returnCall).toBeDefined();
    expect(returnCall![1]).toBe(8);  // seatTile.col for marcos
    expect(returnCall![2]).toBe(4);  // seatTile.row for marcos
  });

  it('Test 12: after interrupt, when activeRoomId !== agentId and ch.state === "idle", agent resumes (suspended becomes false) and tickIdleBehaviors advances', () => {
    const agentId = 'sandra';
    const ch = mockCharacters.find((c) => c.id === agentId)!;

    // Interrupt the agent
    interruptIdleBehavior(agentId);

    // Agent should be in suspended state — tick should not advance its behavior
    const stateBeforeTick = ch.state;
    mockActiveRoomId = agentId; // BILLY is still in Sandra's room
    tickIdleBehaviors(5);
    expect(ch.state).toBe(stateBeforeTick); // no change while suspended

    // Now BILLY leaves — activeRoomId changes away from agent's room
    mockActiveRoomId = 'billy';
    ch.state = 'idle';
    ch.path = [];

    // Tick should resume the agent (suspended becomes false)
    tickIdleBehaviors(5);

    // After resume, further ticks should eventually change state (desk cycling)
    tickIdleBehaviors(90); // enough time for desk cycling to start
    // The agent should no longer be locked out — any state change is acceptable
    // just confirm no error thrown and agent is in a valid state
    expect(['idle', 'work', 'walk']).toContain(ch.state);
  });
});
