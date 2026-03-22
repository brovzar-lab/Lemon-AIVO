/**
 * Character state machine: movement, animation, walk-to-room logic.
 *
 * Core update functions called by the game loop each frame.
 * Handles BILLY walking between rooms via BFS pathfinding with speed ramping,
 * agent idle/work animations, knock pause on room arrival, and War Room
 * agent gathering/dispersal orchestration.
 */
import {
  TILE_SIZE,
  WALK_SPEED,
  WALK_SPEED_FAST,
  SPEED_RAMP_TILES,
  WALK_FRAME_DURATION,
  WORK_FRAME_DURATION,
  TileType,
} from './types';
import type { Character, Direction } from './types';
import { findPath, getCollisionAt } from './tileMap';
import { getRoomAtTile, ROOMS, WAR_ROOM_SEATS } from './officeLayout';
import { useOfficeStore } from '@/store/officeStore';
import { getAudioManager } from './audioManager';
import { useActivityStore } from '@/store/activityStore';
import { getAgent } from '@/config/agents';
import { interruptIdleBehavior } from './idleBehaviorManager';
import { collaboratingAgents } from '@/store/collaborationStore';

/** Number of walk animation frames in a cycle */
const WALK_FRAMES = 4;

/** Number of work animation frames in a cycle */
const WORK_FRAMES = 3;

/** Knock pause duration in seconds */
const KNOCK_DURATION = 0.5;

/** Agents who attend War Room meetings (Wendy stays at her desk) */
const WAR_ROOM_AGENT_IDS = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'] as const;

// Re-export for downstream consumers that import from characters.ts
export { WAR_ROOM_SEATS } from './officeLayout';

/** Whether agents are currently walking to the War Room (prevents re-triggering) */
let isGathering = false;

/** Whether agents have been dispersed from War Room (prevents re-triggering every frame) */
let hasDispersed = false;

/** Timeout IDs from disperseAgentsToOffices — cancelled when re-gathering begins */
let dispersalTimeoutIds: ReturnType<typeof setTimeout>[] = [];

/**
 * Tracks the knock timer per character.
 * When BILLY arrives at a room's billyStandTile, this timer is set.
 * During the knock pause, BILLY is 'idle' and the timer counts down.
 */
const knockTimers = new Map<string, number>();

/**
 * Returns the Direction based on delta between two tile positions.
 * Prioritizes vertical if both axes change.
 */
export function getCharacterDirection(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): Direction {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;

  // Prioritize vertical if both axes change
  if (dr !== 0) {
    return dr < 0 ? 'up' : 'down';
  }
  if (dc !== 0) {
    return dc < 0 ? 'left' : 'right';
  }
  return 'down'; // Default (no movement)
}

/**
 * Main character update function. Switch on ch.state:
 * - 'walk': Advance along BFS path with smooth interpolation
 * - 'work': Cycle animation frames
 * - 'idle': No change
 */
export function updateCharacter(
  ch: Character,
  dt: number,
  _tileMap: TileType[][],
): void {
  switch (ch.state) {
    case 'walk': {
      if (ch.path.length === 0) {
        ch.state = 'idle';
        break;
      }

      // If the next tile in the cached path is now blocked (e.g. furniture placed
      // during editor mode), drop the path so the character stops and reroutes.
      const nextTile = ch.path[0]!;
      if (getCollisionAt(nextTile.col, nextTile.row)) {
        ch.path = [];
        ch.state = 'idle';
        ch.moveProgress = 0;
        ch.x = ch.tileCol * TILE_SIZE;
        ch.y = ch.tileRow * TILE_SIZE;
        break;
      };
      ch.direction = getCharacterDirection(
        ch.tileCol,
        ch.tileRow,
        nextTile.col,
        nextTile.row,
      );

      // Advance move progress
      ch.moveProgress += (ch.speed / TILE_SIZE) * dt;

      // Check if we've arrived at the next tile
      while (ch.moveProgress >= 1 && ch.path.length > 0) {
        const arrived = ch.path.shift()!;
        ch.tileCol = arrived.col;
        ch.tileRow = arrived.row;
        ch.moveProgress -= 1;

        // Update direction for new next tile if available
        if (ch.path.length > 0) {
          const next = ch.path[0]!;
          ch.direction = getCharacterDirection(
            ch.tileCol,
            ch.tileRow,
            next.col,
            next.row,
          );
        }
      }

      // If path exhausted, transition to idle
      if (ch.path.length === 0) {
        ch.state = 'idle';
        ch.moveProgress = 0;
        ch.x = ch.tileCol * TILE_SIZE;
        ch.y = ch.tileRow * TILE_SIZE;
        break;
      }

      // Interpolate pixel position between current tile and next tile
      const target = ch.path[0]!;
      const fromX = ch.tileCol * TILE_SIZE;
      const fromY = ch.tileRow * TILE_SIZE;
      const toX = target.col * TILE_SIZE;
      const toY = target.row * TILE_SIZE;
      ch.x = fromX + (toX - fromX) * ch.moveProgress;
      ch.y = fromY + (toY - fromY) * ch.moveProgress;

      // Cycle walk animation frame
      ch.frameTimer += dt;
      if (ch.frameTimer >= WALK_FRAME_DURATION) {
        ch.frame = (ch.frame + 1) % WALK_FRAMES;
        ch.frameTimer -= WALK_FRAME_DURATION;
      }
      break;
    }

    case 'work': {
      // Cycle animation frames
      ch.frameTimer += dt;
      if (ch.frameTimer >= WORK_FRAME_DURATION) {
        ch.frame = (ch.frame + 1) % WORK_FRAMES;
        ch.frameTimer -= WORK_FRAME_DURATION;
      }
      break;
    }

    case 'idle': {
      // No frame cycling, no position change
      break;
    }
  }
}

/**
 * Updates all characters each frame.
 * After updating BILLY, checks for room entry and handles knock animation
 * and agent reactions.
 */
export function updateAllCharacters(
  dt: number,
  tileMap: TileType[][],
): void {
  const state = useOfficeStore.getState();
  const { characters } = state;

  // Handle knock timer for BILLY
  const billyKnockTimer = knockTimers.get('billy');
  if (billyKnockTimer !== undefined && billyKnockTimer > 0) {
    knockTimers.set('billy', billyKnockTimer - dt);
    if (billyKnockTimer - dt <= 0) {
      knockTimers.delete('billy');
      // Knock is done, update active room
      const billy = characters.find((c) => c.id === 'billy');
      if (billy) {
        const room = getRoomAtTile(billy.tileCol, billy.tileRow);
        if (room && room.id !== 'billy') {
          state.setActiveRoom(room.id);
          state.setBillyPosition(billy.tileCol, billy.tileRow);
        }
      }
    }
    // During knock pause, still update non-BILLY characters
    for (const ch of characters) {
      if (ch.id !== 'billy') {
        updateCharacter(ch, dt, tileMap);
      }
    }
    return;
  }

  // Track BILLY's previous tile position for room entry detection
  const billy = characters.find((c) => c.id === 'billy');
  const prevBillyCol = billy?.tileCol;
  const prevBillyRow = billy?.tileRow;

  // Update all characters
  for (const ch of characters) {
    updateCharacter(ch, dt, tileMap);
  }

  // Drive agent character animations from agentStatuses (Zustand bridge)
  const agentStatuses = state.agentStatuses ?? {};
  for (const ch of characters) {
    if (ch.id === 'billy') continue;
    const status = agentStatuses[ch.id];
    if (status === 'thinking') {
      // Switch to work animation (fast typing) unless walking
      if (ch.state === 'idle' || ch.state === 'work') {
        ch.state = 'work';
      }
    } else if (status === 'idle' || status === 'needs-attention') {
      // Return to idle if previously in work state (from thinking)
      if (ch.state === 'work') {
        ch.state = 'idle';
      }
    }
  }

  // Detect leaving War Room: targetRoomId changed away from war-room
  if (
    state.targetRoomId != null &&
    state.targetRoomId !== 'war-room' &&
    state.activeRoomId === 'war-room' &&
    !hasDispersed
  ) {
    hasDispersed = true;
    disperseAgentsToOffices(tileMap);
  }

  // Check if BILLY entered a new tile
  if (billy && (billy.tileCol !== prevBillyCol || billy.tileRow !== prevBillyRow)) {
    const room = getRoomAtTile(billy.tileCol, billy.tileRow);

    if (room && billy.state === 'idle' && billy.path.length === 0) {
      if (room.id === 'billy') {
        // BILLY returned to his own office — show overview panel
        state.setActiveRoom('billy');
      } else if (room.id === 'war-room') {
        // BILLY entered the War Room — skip knock, trigger gathering
        state.setActiveRoom('war-room');
        // Reset both flags BEFORE calling gather to ensure re-entry always triggers fresh gathering
        isGathering = false;
        hasDispersed = false;
        gatherAgentsToWarRoom(tileMap);
      } else {
        // BILLY entered an agent's room — interrupt idle behavior, then start knock pause
        // Skip interrupt if agent is actively collaborating (collaboration immune to BILLY room-entry)
        if (!collaboratingAgents.has(room.id)) {
          interruptIdleBehavior(room.id);
        }
        knockTimers.set('billy', KNOCK_DURATION);
        void getAudioManager().playSfx('knock');

        // Make agent face BILLY
        const agent = characters.find((c) => c.id === room.id);
        if (agent && (agent.state === 'work' || agent.state === 'idle')) {
          agent.state = 'idle';
          agent.direction = getCharacterDirection(
            agent.tileCol,
            agent.tileRow,
            billy.tileCol,
            billy.tileRow,
          );
        }
      }
    }

    // Update BILLY's position in the store
    state.setBillyPosition(billy.tileCol, billy.tileRow);
  }
}

/**
 * Walk all 5 agents to their War Room seats with staggered starts.
 * Returns a Promise that resolves when all agents are seated at their
 * assigned positions (state === 'idle', path empty, matching seat tile).
 */
/** Maximum time (ms) to wait for agents to reach their War Room seats */
const GATHER_TIMEOUT_MS = 15_000;

export function gatherAgentsToWarRoom(tileMap: TileType[][]): Promise<void> {
  if (isGathering) return Promise.resolve();
  isGathering = true;
  hasDispersed = false;

  // Cancel any pending dispersal timeouts that could override this gather
  for (const id of dispersalTimeoutIds) clearTimeout(id);
  dispersalTimeoutIds = [];

  // Suspend idle behaviors for all agents so tickAgentBehavior() cannot override
  // the 'walk' state set by startWalk() below (desk-typing/resting cases set
  // ch.state = 'work'/'idle' every tick, killing the walk immediately).
  for (const agentId of WAR_ROOM_AGENT_IDS) {
    interruptIdleBehavior(agentId);
  }

  // Log to activity feed
  for (const agentId of WAR_ROOM_AGENT_IDS) {
    const agentConfig = getAgent(agentId as import('@/types/agent').AgentId);
    if (agentConfig) {
      useActivityStore.getState().logActivity(agentConfig.name, 'walking to the boardroom');
    }
  }

  return new Promise((resolve) => {
    // Walk BILLY to his seat at the head of the table
    const billySeat = WAR_ROOM_SEATS['billy'];
    if (billySeat) {
      startWalk('billy', billySeat.col, billySeat.row, tileMap);
    }

    WAR_ROOM_AGENT_IDS.forEach((agentId, index) => {
      const delay = index * (500 + Math.random() * 500);
      setTimeout(() => {
        const seat = WAR_ROOM_SEATS[agentId];
        if (seat) startWalk(agentId, seat.col, seat.row, tileMap);
      }, delay);
    });

    const startTime = Date.now();

    // Poll for all agents seated at their War Room positions
    const checkInterval = setInterval(() => {
      const { characters } = useOfficeStore.getState();
      const allSeated = WAR_ROOM_AGENT_IDS.every((id) => {
        const ch = characters.find((c) => c.id === id);
        if (!ch) return false;
        const seat = WAR_ROOM_SEATS[id];
        if (!seat) return false;
        return (
          ch.state === 'idle' &&
          ch.path.length === 0 &&
          ch.tileCol === seat.col &&
          ch.tileRow === seat.row
        );
      });

      if (allSeated || Date.now() - startTime >= GATHER_TIMEOUT_MS) {
        clearInterval(checkInterval);
        isGathering = false;
        resolve();
      }
    }, 100);
  });
}

/**
 * Walk all 5 agents back to their office seats with staggered starts.
 * Fire-and-forget -- no Promise needed. Agents walk back in background.
 */
export function disperseAgentsToOffices(tileMap: TileType[][]): void {
  // Ensure gathering flag is cleared so re-entry can trigger fresh gathering
  isGathering = false;
  // Shuffle so agents leave in a random order
  const shuffled = [...WAR_ROOM_AGENT_IDS].sort(() => Math.random() - 0.5);
  shuffled.forEach((agentId, index) => {
    // ~15s between each agent, ±3s jitter
    const delay = index * (15_000 + (Math.random() - 0.5) * 6_000);
    const id = setTimeout(() => {
      const room = ROOMS.find((r) => r.id === agentId);
      if (room) {
        startWalk(agentId, room.seatTile.col, room.seatTile.row, tileMap);
      }
    }, delay);
    dispersalTimeoutIds.push(id);
  });
}

/**
 * Starts BILLY walking to a target tile.
 * Finds the character in the store, computes BFS path, assigns it,
 * and sets appropriate walk speed.
 */
export function startWalk(
  characterId: string,
  targetCol: number,
  targetRow: number,
  tileMap: TileType[][],
): void {
  const state = useOfficeStore.getState();
  const ch = state.characters.find((c) => c.id === characterId);
  if (!ch) return;

  const path = findPath(ch.tileCol, ch.tileRow, targetCol, targetRow, tileMap);

  if (path.length === 0) {
    // Warn if this was a critical navigation target (seat tile or War Room seat)
    const allSeatTiles = ROOMS.map(r => r.seatTile);
    const allWarRoomSeats = Object.values(WAR_ROOM_SEATS);
    const isCriticalTarget = [...allSeatTiles, ...allWarRoomSeats].some(
      t => t.col === targetCol && t.row === targetRow
    );
    if (isCriticalTarget) {
      console.warn(
        `[characters] startWalk: unreachable critical target (${targetCol},${targetRow}) for ${characterId}`
      );
    }
    return;
  }

  ch.path = path;
  ch.state = 'walk';
  ch.moveProgress = 0;
  ch.frame = 0;
  ch.frameTimer = 0;
  ch.speed = path.length > SPEED_RAMP_TILES ? WALK_SPEED_FAST : WALK_SPEED;

  // Clear any existing knock timer
  knockTimers.delete(characterId);
}
