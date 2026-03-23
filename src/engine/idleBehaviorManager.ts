/**
 * IdleBehaviorManager — engine-local idle behavior state machine.
 *
 * All per-agent idle behavior state lives in module-scoped Maps, mirroring the
 * established knockTimers / dispersalTimeoutIds pattern from characters.ts.
 *
 * CRITICAL: No Zustand set() calls. Direct Character object mutations (ch.state,
 * ch.direction) do NOT trigger React re-renders — only Zustand set() does.
 *
 * Requirements: IDLE-01, IDLE-02, IDLE-03, IDLE-04, IDLE-05
 */

import { useOfficeStore } from '@/store/officeStore';
import { ROOMS, OFFICE_TILE_MAP } from './officeLayout';
import { startWalk } from './characters';
import { collaboratingAgents } from '@/store/collaborationStore';
import type { Character } from './types';
import type { AgentId } from '@/types/agent';
import { useActivityStore } from '@/store/activityStore';
import { getAgent } from '@/config/agents';

// ── Types ─────────────────────────────────────────────────────────────────────

type BehaviorPhase =
  | 'desk-typing'         // desk cycle: typing burst → ch.state = 'work'
  | 'desk-resting'        // desk cycle: idle rest → ch.state = 'idle'
  | 'walking-to-cooler'   // BFS walk to (16, 32) in progress
  | 'at-cooler'           // paused at cooler stand tile
  | 'walking-back'        // BFS walk back to seatTile in progress
  | 'stretching'          // frozen idle + stretch emote bubble
  | 'suspended';          // BILLY is in the agent's room

interface AgentIdleState {
  phase: BehaviorPhase;
  phaseTimer: number;     // seconds remaining in current phase
  cooldownTimer: number;  // seconds until next water-cooler trip
  stretchCooldown: number; // seconds until next stretch event
  suspended: boolean;
}

// ── Module-scoped state ───────────────────────────────────────────────────────

/** Per-agent behavior state — NOT exported (internal to this module) */
const agentStates = new Map<string, AgentIdleState>();

/** Whether the water cooler is currently occupied — prevents race conditions */
let coolerOccupied = false;

/** Grace period in seconds — no behaviors fire until this reaches 0 */
let gracePeriod = 10;

// ── Constants ─────────────────────────────────────────────────────────────────

/** Stand tile one row south of the water cooler at (16, 31) — confirmed walkable (hallway FLOOR) */
const WATER_COOLER_STAND = { col: 22, row: 27 };

/** All 6 agent IDs (room IDs match agent IDs by convention) */
const AGENT_IDS = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'] as const;

/**
 * Per-agent personality multipliers applied to all behavior timers.
 * Higher = stays at desk longer / less frequent behaviors.
 */
const AGENT_MULTIPLIERS: Record<string, number> = {
  isaac:   1.5,  // focused developer — stays at desk longest
  wendy:   0.7,  // social coach — most active
  patrik:  1.0,  // baseline
  marcos:  0.9,  // slightly active
  sandra:  1.1,  // slightly focused
  charlie: 0.8,  // moderately active
};

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Set of agents currently showing the stretch emote bubble.
 * Renderer reads this directly — no Zustand required.
 */
export const stretchingAgents = new Set<string>();


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize (or reset) all idle behavior state.
 * Call once at app start and on game reset.
 * Grace period is set here (not at module scope) to avoid hot-reload pitfall.
 */
export function initIdleBehaviors(): void {
  agentStates.clear();
  stretchingAgents.clear();
  coolerOccupied = false;
  gracePeriod = 8 + Math.random() * 7; // 8–15s — office wakes up fast

  for (const id of AGENT_IDS) {
    const mult = AGENT_MULTIPLIERS[id] ?? 1.0;
    agentStates.set(id, {
      phase: 'desk-resting',
      // Stagger initial phase offsets so agents don't all switch simultaneously
      phaseTimer: (2 + Math.random() * 2) * mult,
      // Game-scale cooldowns: agents move frequently so the office feels alive
      cooldownTimer: (45 + Math.random() * 45) * mult,   // 45–90s base
      stretchCooldown: (30 + Math.random() * 30) * mult,  // 30–60s base
      suspended: false,
    });
  }
}

/**
 * Advance all idle behavior state machines by `dt` seconds.
 * Called from gameLoop.ts after updateAllCharacters().
 */
export function tickIdleBehaviors(dt: number): void {
  // Grace period: no behaviors until the office "settles" after load
  if (gracePeriod > 0) {
    gracePeriod -= dt;
    return;
  }

  const state = useOfficeStore.getState();
  const { characters, activeRoomId, agentStatuses } = state;

  for (const [agentId, s] of agentStates) {
    if (s.suspended) {
      // Resume check: BILLY has left and agent is idle at their desk
      if (activeRoomId !== agentId) {
        const ch = characters.find((c) => c.id === agentId);
        if (ch && ch.state === 'idle' && ch.path.length === 0) {
          resumeIdleBehavior(agentId);
        }
      }
      continue;
    }

    const ch = characters.find((c) => c.id === agentId);
    if (!ch) continue;

    // Respect AI-processing state: 'thinking' means updateAllCharacters owns ch.state
    const agentStatus = agentStatuses?.[agentId];
    if (agentStatus === 'thinking') continue;

    // Respect collaboration system: agent owned by chainRunner during hop processing
    if (collaboratingAgents.has(agentId as AgentId)) continue;

    // Decrement behavior cooldowns every frame
    s.cooldownTimer -= dt;
    s.stretchCooldown -= dt;

    tickAgentBehavior(agentId, s, ch, dt);
  }
}

/**
 * Immediately suspend an agent's idle behavior.
 * Called when BILLY enters the agent's room or a message is sent to the agent.
 *
 * - Releases cooler lock if agent was on a cooler trip
 * - Clears stretch emote
 * - Forces BFS return to seatTile if agent is mid-walk
 */
export function interruptIdleBehavior(agentId: string): void {
  const s = agentStates.get(agentId);
  if (!s) return;

  // Release cooler lock if this agent was on a trip
  if (s.phase === 'walking-to-cooler' || s.phase === 'at-cooler') {
    coolerOccupied = false;
  }

  // Clear stretch emote
  stretchingAgents.delete(agentId);

  // Suspend all behaviors
  s.phase = 'suspended';
  s.suspended = true;

  // If agent is mid-walk, send them home
  const { characters } = useOfficeStore.getState();
  const ch = characters.find((c) => c.id === agentId);
  if (ch && ch.state === 'walk') {
    const room = ROOMS.find((r) => r.id === agentId);
    if (room) {
      startWalk(agentId, room.seatTile.col, room.seatTile.row, OFFICE_TILE_MAP);
    }
  } else if (ch) {
    // Ensure agent is visibly idle (not frozen in 'work' animation)
    ch.state = 'idle';
  }
}

/**
 * Resume a suspended agent with fresh random timers.
 * Called automatically from tickIdleBehaviors when BILLY leaves the room
 * and the agent is back at their desk in idle state.
 */
export function resumeIdleBehavior(agentId: string): void {
  const s = agentStates.get(agentId);
  if (!s || !s.suspended) return;

  const mult = AGENT_MULTIPLIERS[agentId] ?? 1.0;
  s.suspended = false;
  s.phase = 'desk-resting';
  s.phaseTimer = (1 + Math.random() * 2) * mult;
  s.cooldownTimer = (45 + Math.random() * 45) * mult;   // 45–90s
  s.stretchCooldown = (30 + Math.random() * 30) * mult;  // 30–60s
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Advance a single agent's behavior state machine by one tick.
 * Called from tickIdleBehaviors after precondition guards.
 */
function tickAgentBehavior(
  agentId: string,
  s: AgentIdleState,
  ch: Character,
  dt: number,
): void {
  const mult = AGENT_MULTIPLIERS[agentId] ?? 1.0;
  const room = ROOMS.find((r) => r.id === agentId);

  switch (s.phase) {
    case 'desk-typing': {
      // Desk cycle: typing burst — sit at desk facing monitor (north)
      ch.state = 'sit';
      if (room) ch.direction = 'up';
      s.phaseTimer -= dt;

      if (s.phaseTimer <= 0) {
        // Transition to resting — stay seated, still face monitor
        s.phase = 'desk-resting';
        s.phaseTimer = (2 + Math.random() * 2) * mult; // 2–4s rest
        ch.state = 'sit';
        if (room) ch.direction = 'up';
      }

      // Check if a behavior should fire during typing
      if (s.cooldownTimer <= 0 && !coolerOccupied) {
        startWaterCoolerTrip(agentId, s);
        return;
      }
      if (s.cooldownTimer <= 0 && coolerOccupied) {
        // Cooler occupied — reschedule and do not walk
        s.cooldownTimer = (30 + Math.random() * 30) * mult; // 30–60s retry
      }
      if (s.stretchCooldown <= 0) {
        startStretch(agentId, s, ch);
        return;
      }
      break;
    }

    case 'desk-resting': {
      // Desk cycle: rest break — still seated, glance at viewer (south)
      ch.state = 'sit';
      if (room) ch.direction = 'down';
      s.phaseTimer -= dt;

      if (s.phaseTimer <= 0) {
        // Transition to typing
        s.phase = 'desk-typing';
        s.phaseTimer = (2 + Math.random() * 1) * mult; // 2–3s typing
      }

      // Check if a behavior should fire during rest
      if (s.cooldownTimer <= 0 && !coolerOccupied) {
        startWaterCoolerTrip(agentId, s);
        return;
      }
      if (s.cooldownTimer <= 0 && coolerOccupied) {
        // Cooler occupied — reschedule
        s.cooldownTimer = (3 + Math.random() * 2) * 60 * mult;
      }
      if (s.stretchCooldown <= 0) {
        startStretch(agentId, s, ch);
        return;
      }
      break;
    }

    case 'walking-to-cooler': {
      // Wait for BFS walk to complete (ch.state returns to 'idle' when path exhausted)
      if (ch.state === 'idle' && ch.path.length === 0) {
        s.phase = 'at-cooler';
        s.phaseTimer = 5.0; // ~5s pause at cooler
        ch.direction = 'up'; // face north toward cooler furniture
        // Fall through to process at-cooler in the same tick if dt is large enough
        // (handles the case where dt > 5s in tests)
        s.phaseTimer -= dt;
        if (s.phaseTimer <= 0) {
          if (room) {
            startWalk(agentId, room.seatTile.col, room.seatTile.row, OFFICE_TILE_MAP);
          }
          s.phase = 'walking-back';
          coolerOccupied = false;
        } else {
          ch.state = 'idle';
        }
      }
      break;
    }

    case 'at-cooler': {
      ch.state = 'idle';
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        // Head back to desk
        if (room) {
          startWalk(agentId, room.seatTile.col, room.seatTile.row, OFFICE_TILE_MAP);
        }
        s.phase = 'walking-back';
        coolerOccupied = false; // release lock so next agent can go
      }
      break;
    }

    case 'walking-back': {
      // Wait for return walk to complete
      if (ch.state === 'idle' && ch.path.length === 0) {
        // Back at desk — sit down and resume cycling with fresh offsets
        ch.state = 'sit';
        s.phase = 'desk-resting';
        s.phaseTimer = (1 + Math.random() * 1) * mult;
        s.cooldownTimer = (45 + Math.random() * 45) * mult; // 45–90s next trip
        if (room) ch.direction = 'down'; // glance at viewer on return
      }
      break;
    }

    case 'stretching': {
      // Frozen at desk with stretch emote bubble
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        // Stretch complete — sit back down
        stretchingAgents.delete(agentId);
        ch.state = 'sit';
        s.phase = 'desk-resting';
        s.phaseTimer = (1 + Math.random() * 1) * mult;
        s.stretchCooldown = (30 + Math.random() * 30) * mult; // 30–60s next stretch
        if (room) ch.direction = 'down'; // glance at viewer
      }
      break;
    }

    case 'suspended':
      // Should not reach here (handled in tickIdleBehaviors loop)
      break;
  }
}

/** Start a water cooler trip for the given agent. Sets coolerOccupied immediately. */
function startWaterCoolerTrip(agentId: string, s: AgentIdleState): void {
  // Claim cooler BEFORE any other agent in the same tick can check
  coolerOccupied = true;
  startWalk(agentId, WATER_COOLER_STAND.col, WATER_COOLER_STAND.row, OFFICE_TILE_MAP);
  s.phase = 'walking-to-cooler';
  s.phaseTimer = 0; // will be set when walk completes

  // Log to activity feed
  const agentConfig = getAgent(agentId as import('@/types/agent').AgentId);
  if (agentConfig) {
    useActivityStore.getState().logActivity(agentConfig.name, 'went to the water cooler');
  }
}

/** Start a stretch event for the given agent. */
function startStretch(agentId: string, s: AgentIdleState, ch: Character): void {
  stretchingAgents.add(agentId);
  s.phase = 'stretching';
  s.phaseTimer = 5 + Math.random() * 3; // 5–8s
  ch.state = 'idle';
  ch.direction = 'down'; // face viewer (south) during stretch
}
