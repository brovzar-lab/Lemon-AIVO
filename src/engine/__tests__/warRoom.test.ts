/**
 * War Room engine tests: agent gathering/dispersal, seat positions, '6' key shortcut.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TileType, TILE_SIZE, WALK_SPEED } from '../types';
import type { Character } from '../types';
import { createTileMap } from '../tileMap';

/**
 * Helper: create a test character at a given tile position.
 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  const tileCol = overrides.tileCol ?? 5;
  const tileRow = overrides.tileRow ?? 5;
  return {
    id: 'billy',
    x: tileCol * TILE_SIZE,
    y: tileRow * TILE_SIZE,
    tileCol,
    tileRow,
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

// ── WAR_ROOM_SEATS positions ──────────────────────────────────────────────────

describe('WAR_ROOM_SEATS', () => {
  it('has entries for all 6 agents plus billy', async () => {
    const { WAR_ROOM_SEATS } = await import('../officeLayout');
    const agents = ['billy', 'patrik', 'marcos', 'sandra', 'isaac', 'charlie'];
    for (const agent of agents) {
      expect(WAR_ROOM_SEATS).toHaveProperty(agent);
      expect(WAR_ROOM_SEATS[agent]).toHaveProperty('col');
      expect(WAR_ROOM_SEATS[agent]).toHaveProperty('row');
    }
  });

  it('all seat positions are within War Room interior (derived from ROOMS)', async () => {
    const { WAR_ROOM_SEATS, ROOMS } = await import('../officeLayout');
    const warRoom = ROOMS.find((r) => r.id === 'war-room')!;
    const interior = {
      minCol: warRoom.tileRect.col + 1,
      maxCol: warRoom.tileRect.col + warRoom.tileRect.width - 2,
      minRow: warRoom.tileRect.row + 1,
      maxRow: warRoom.tileRect.row + warRoom.tileRect.height - 2,
    };

    for (const [agent, seat] of Object.entries(WAR_ROOM_SEATS)) {
      expect(seat.col, `${agent} col should be >= ${interior.minCol}`).toBeGreaterThanOrEqual(interior.minCol);
      expect(seat.col, `${agent} col should be <= ${interior.maxCol}`).toBeLessThanOrEqual(interior.maxCol);
      expect(seat.row, `${agent} row should be >= ${interior.minRow}`).toBeGreaterThanOrEqual(interior.minRow);
      expect(seat.row, `${agent} row should be <= ${interior.maxRow}`).toBeLessThanOrEqual(interior.maxRow);
    }
  });

  it('no seat position overlaps with any non-chair war-room furniture', async () => {
    const { WAR_ROOM_SEATS, FURNITURE } = await import('../officeLayout');
    // Check seats against all non-chair furniture in the war room
    const warRoomNonChairFurniture = FURNITURE.filter(
      (f) => f.roomId === 'war-room' && f.type !== 'chair',
    );
    for (const [agent, seat] of Object.entries(WAR_ROOM_SEATS)) {
      for (const item of warRoomNonChairFurniture) {
        const onItem =
          seat.col >= item.col && seat.col < item.col + item.width &&
          seat.row >= item.row && seat.row < item.row + item.height;
        expect(onItem, `${agent} should NOT be on ${item.type} at (${item.col},${item.row})`).toBe(false);
      }
    }
  });
});

// ── gatherAgentsToWarRoom ─────────────────────────────────────────────────────

describe('gatherAgentsToWarRoom', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    tileMap = createTileMap(50, 50, TileType.FLOOR);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls startWalk for all 5 agents toward their seat tiles', async () => {
    const agents = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];
    const characters = agents.map((id) =>
      makeCharacter({ id, tileCol: 5, tileRow: 5 }),
    );
    characters.push(makeCharacter({ id: 'billy', tileCol: 20, tileRow: 15 }));

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters,
          agentStatuses: { patrik: 'idle', marcos: 'idle', sandra: 'idle', isaac: 'idle', charlie: 'idle' },
          activeRoomId: null,
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [{ col: 6, row: 5 }]),
      };
    });

    const mod = await import('../characters');
    // Spy on startWalk by re-mocking -- but since gatherAgentsToWarRoom calls startWalk internally,
    // we need to track the calls via the findPath mock (startWalk calls findPath internally)
    const { gatherAgentsToWarRoom, WAR_ROOM_SEATS } = mod;

    // Start gathering
    const promise = gatherAgentsToWarRoom(tileMap);

    // Advance timers enough for all staggered starts (5 agents * max 1000ms each = 5s max)
    await vi.advanceTimersByTimeAsync(6000);

    // All agents should now be in walk state (startWalk was called for each)
    for (const agent of agents) {
      const ch = characters.find((c) => c.id === agent)!;
      expect(ch.state, `${agent} should be walking`).toBe('walk');
    }

    // Now simulate agents arriving at their seats (set them to idle at seat positions)
    for (const agent of agents) {
      const ch = characters.find((c) => c.id === agent)!;
      const seat = WAR_ROOM_SEATS[agent]!;
      ch.state = 'idle';
      ch.path = [];
      ch.tileCol = seat.col;
      ch.tileRow = seat.row;
    }

    // Advance timer for polling interval to detect seated agents
    await vi.advanceTimersByTimeAsync(200);

    // Promise should resolve
    await promise;
  });

  it('uses staggered setTimeout calls for agent starts', async () => {
    const agents = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];
    const characters = agents.map((id) =>
      makeCharacter({ id, tileCol: 5, tileRow: 5 }),
    );
    characters.push(makeCharacter({ id: 'billy', tileCol: 20, tileRow: 15 }));

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters,
          agentStatuses: { patrik: 'idle', marcos: 'idle', sandra: 'idle', isaac: 'idle', charlie: 'idle' },
          activeRoomId: null,
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [{ col: 6, row: 5 }]),
      };
    });

    const { gatherAgentsToWarRoom, WAR_ROOM_SEATS: _WAR_ROOM_SEATS } = await import('../characters');

    // Mock Math.random to return 0 for deterministic stagger delays
    // delay = index * (500 + 0) = 0, 500, 1000, 1500, 2000ms
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    gatherAgentsToWarRoom(tileMap);

    // First agent delay = 0 * 500 = 0ms, so patrik walks immediately
    // Second agent delay = 1 * 500 = 500ms
    // Advance by 100ms: first agent should be walking, second should NOT
    await vi.advanceTimersByTimeAsync(100);

    const patrik = characters.find((c) => c.id === 'patrik')!;
    expect(patrik.state).toBe('walk'); // First agent starts immediately (index=0)

    // At 100ms, marcos (index=1) should NOT be walking yet (delay 500ms)
    const marcos = characters.find((c) => c.id === 'marcos')!;
    expect(marcos.state).toBe('idle');

    // Advance to 600ms -- marcos should now be walking (passed 500ms delay)
    await vi.advanceTimersByTimeAsync(500);

    expect(marcos.state).toBe('walk');

    randomSpy.mockRestore();
  });

  it('resolves when all agents reach idle state at their seats', async () => {
    const agents = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];
    const characters = agents.map((id) =>
      makeCharacter({ id, tileCol: 5, tileRow: 5 }),
    );
    characters.push(makeCharacter({ id: 'billy', tileCol: 20, tileRow: 15 }));

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters,
          agentStatuses: { patrik: 'idle', marcos: 'idle', sandra: 'idle', isaac: 'idle', charlie: 'idle' },
          activeRoomId: null,
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [{ col: 6, row: 5 }]),
      };
    });

    const { gatherAgentsToWarRoom, WAR_ROOM_SEATS } = await import('../characters');

    let resolved = false;
    const promise = gatherAgentsToWarRoom(tileMap).then(() => {
      resolved = true;
    });

    // Advance timers to let all walks start
    await vi.advanceTimersByTimeAsync(6000);

    // Not yet resolved (agents still walking)
    expect(resolved).toBe(false);

    // Simulate all but last agent arriving
    for (const agent of agents.slice(0, agents.length - 1)) {
      const ch = characters.find((c) => c.id === agent)!;
      const seat = WAR_ROOM_SEATS[agent]!;
      ch.state = 'idle';
      ch.path = [];
      ch.tileCol = seat.col;
      ch.tileRow = seat.row;
    }

    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(false); // Still waiting for last agent

    // Last agent arrives
    const lastAgent = agents[agents.length - 1]!;
    const lastCh = characters.find((c) => c.id === lastAgent)!;
    const valSeat = WAR_ROOM_SEATS[lastAgent]!;
    lastCh.state = 'idle';
    lastCh.path = [];
    lastCh.tileCol = valSeat.col;
    lastCh.tileRow = valSeat.row;

    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(true);

    await promise;
  });
});

// ── disperseAgentsToOffices ───────────────────────────────────────────────────

describe('disperseAgentsToOffices', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    tileMap = createTileMap(50, 50, TileType.FLOOR);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls startWalk for each agent back to their office seatTile', async () => {
    const agents = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];
    const characters = agents.map((id) =>
      makeCharacter({ id, tileCol: 20, tileRow: 15 }),
    );
    characters.push(makeCharacter({ id: 'billy', tileCol: 21, tileRow: 15 }));

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters,
          agentStatuses: { patrik: 'idle', marcos: 'idle', sandra: 'idle', isaac: 'idle', charlie: 'idle' },
          activeRoomId: 'war-room',
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [{ col: 6, row: 5 }]),
      };
    });

    // Use actual ROOMS so disperseAgentsToOffices can find each agent's room
    const { ROOMS } = await import('../officeLayout');
    vi.doMock('../officeLayout', () => ({
      ROOMS,
      OFFICE_TILE_MAP: tileMap,
      getRoomAtTile: vi.fn(),
    }));

    // Re-import after all mocks are set
    vi.resetModules();
    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters,
          agentStatuses: { patrik: 'idle', marcos: 'idle', sandra: 'idle', isaac: 'idle', charlie: 'idle' },
          activeRoomId: 'war-room',
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));
    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [{ col: 6, row: 5 }]),
      };
    });

    const { disperseAgentsToOffices } = await import('../characters');

    disperseAgentsToOffices(tileMap);

    // Advance timers past the max possible stagger: 6 agents × (15s + 3s jitter) = ~108s
    await vi.advanceTimersByTimeAsync(110_000);

    // All agents should be in walk state (heading back to their offices)
    for (const agent of agents) {
      const ch = characters.find((c) => c.id === agent)!;
      expect(ch.state, `${agent} should be walking back to office`).toBe('walk');
    }
  });
});

// ── updateAllCharacters War Room entry ────────────────────────────────────────

describe('updateAllCharacters - War Room entry', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    vi.resetModules();
    tileMap = createTileMap(50, 50, TileType.FLOOR);
  });

  it('sets activeRoom to war-room when BILLY arrives (no knock animation)', async () => {
    const billyChar = makeCharacter({
      id: 'billy',
      state: 'walk',
      tileCol: 20,
      tileRow: 14,
      x: 20 * TILE_SIZE,
      y: 14 * TILE_SIZE,
      path: [{ col: 20, row: 13 }], // billyStandTile for war-room
      speed: WALK_SPEED,
      moveProgress: 0.99,
    });

    const agents = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];
    const agentChars = agents.map((id) =>
      makeCharacter({ id, tileCol: 8, tileRow: 15 }),
    );

    const setActiveRoom = vi.fn();
    const setBillyPosition = vi.fn();

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billyChar, ...agentChars],
          activeRoomId: null,
          targetRoomId: 'war-room',
          agentStatuses: { patrik: 'idle', marcos: 'idle', sandra: 'idle', isaac: 'idle', charlie: 'idle' },
          setActiveRoom,
          setBillyPosition,
          setTargetRoom: vi.fn(),
        }),
      },
    }));

    vi.doMock('../officeLayout', () => ({
      ROOMS: [
        {
          id: 'war-room',
          name: 'War Room',
          tileRect: { col: 16, row: 11, width: 10, height: 10 },
          doorTile: { col: 20, row: 11 },
          seatTile: { col: 20, row: 13 },
          billyStandTile: { col: 20, row: 13 },
        },
        {
          id: 'patrik',
          name: "Patrik's Office",
          tileRect: { col: 4, row: 11, width: 10, height: 10 },
          doorTile: { col: 8, row: 11 },
          seatTile: { col: 8, row: 15 },
          billyStandTile: { col: 9, row: 15 },
        },
      ],
      WAR_ROOM_SEATS: {
        billy:     { col: 20, row: 12 },
        patrik:     { col: 18, row: 13 },
        marcos:    { col: 22, row: 13 },
        sandra:     { col: 18, row: 15 },
        isaac:   { col: 22, row: 15 },
        charlie: { col: 21, row: 16 },
      },
      OFFICE_TILE_MAP: tileMap,
      getRoomAtTile: (col: number, row: number) => {
        if (col >= 16 && col < 26 && row >= 11 && row < 21) {
          return {
            id: 'war-room',
            name: 'War Room',
            tileRect: { col: 16, row: 11, width: 10, height: 10 },
            doorTile: { col: 20, row: 11 },
            seatTile: { col: 20, row: 15 },
            billyStandTile: { col: 21, row: 15 },
          };
        }
        return null;
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [{ col: 6, row: 5 }]),
      };
    });

    const { updateAllCharacters } = await import('../characters');

    // BILLY arrives at War Room
    updateAllCharacters(0.1, tileMap);

    // Should call setActiveRoom('war-room') -- NOT the knock pattern
    expect(setActiveRoom).toHaveBeenCalledWith('war-room');
  });
});

// ── '6' key shortcut (War Room) ───────────────────────────────────────────────

describe("'6' key shortcut", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("triggers BILLY walking to War Room billyStandTile", async () => {
    const billyChar = makeCharacter({
      id: 'billy',
      tileCol: 20,
      tileRow: 5,
    });

    const setTargetRoom = vi.fn();

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billyChar],
          activeRoomId: 'billy',
          targetRoomId: null,
          agentStatuses: {},
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
          setTargetRoom,
          camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: 'billy' },
          zoomLevel: 2,
          setZoomLevel: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [
          { col: 21, row: 10 },
          { col: 20, row: 13 },
        ]),
      };
    });

    const { setupInputHandlers } = await import('../input');

    // Create a mock canvas
    const canvas = document.createElement('canvas');
    const cleanup = setupInputHandlers(canvas);

    // Simulate '6' keypress (War Room shortcut)
    const event = new KeyboardEvent('keydown', { key: '6' });
    window.dispatchEvent(event);

    // setTargetRoom should be called with 'war-room'
    expect(setTargetRoom).toHaveBeenCalledWith('war-room');

    // BILLY should be in walk state
    expect(billyChar.state).toBe('walk');

    cleanup();
  });
});
