import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TileType, TILE_SIZE, WALK_SPEED, WALK_SPEED_FAST, SPEED_RAMP_TILES, WALK_FRAME_DURATION, WORK_FRAME_DURATION } from '../types';
import type { Character, TileCoord } from '../types';
import { createTileMap } from '../tileMap';

/**
 * Helper: create a test character at a given tile position.
 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'billy',
    x: (overrides.tileCol ?? 5) * TILE_SIZE,
    y: (overrides.tileRow ?? 5) * TILE_SIZE,
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

// ── updateCharacter: walk state ─────────────────────────────────────────────

describe('updateCharacter - walk state', () => {
  let updateCharacter: typeof import('../characters').updateCharacter;
  let tileMap: TileType[][];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../characters');
    const tileMapMod = await import('../tileMap');
    // Clear global collision overlay so tests don't depend on office furniture positions
    tileMapMod.resetCollisionOverlay();
    updateCharacter = mod.updateCharacter;
    tileMap = createTileMap(20, 20, TileType.FLOOR);
  });

  it('advances moveProgress by (speed / TILE_SIZE) * dt', () => {
    const ch = makeCharacter({
      state: 'walk',
      path: [{ col: 6, row: 5 }],
      speed: WALK_SPEED,
      moveProgress: 0,
    });
    const dt = 0.05; // 50ms
    updateCharacter(ch, dt, tileMap);
    const expected = (WALK_SPEED / TILE_SIZE) * dt;
    expect(ch.moveProgress).toBeCloseTo(expected, 5);
  });

  it('snaps to next tile when moveProgress >= 1 and resets moveProgress', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      path: [{ col: 6, row: 5 }, { col: 7, row: 5 }],
      speed: WALK_SPEED,
      moveProgress: 0.95,
    });
    // Small dt that just pushes past 1.0 for one tile
    // Need progress to go from 0.95 to >= 1.0: (WALK_SPEED / TILE_SIZE) * dt >= 0.05
    // (64 / 16) * dt >= 0.05 -> dt >= 0.0125
    const dt = 0.02; // Advances by 0.08, total 1.03 -> snaps to tile 6, remaining 0.03
    updateCharacter(ch, dt, tileMap);
    expect(ch.tileCol).toBe(6);
    expect(ch.tileRow).toBe(5);
    expect(ch.moveProgress).toBeCloseTo(0.03, 2);
  });

  it('transitions from walk to idle when path is exhausted', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      path: [{ col: 6, row: 5 }],
      speed: WALK_SPEED,
      moveProgress: 0.95,
    });
    // Push through the last tile: (64/16) * 0.02 = 0.08, total = 1.03
    const dt = 0.02;
    updateCharacter(ch, dt, tileMap);
    expect(ch.tileCol).toBe(6);
    expect(ch.state).toBe('idle');
  });

  it('cycles walk animation frame every WALK_FRAME_DURATION seconds', () => {
    const ch = makeCharacter({
      state: 'walk',
      path: [{ col: 6, row: 5 }, { col: 7, row: 5 }, { col: 8, row: 5 }],
      speed: WALK_SPEED,
      frame: 0,
      frameTimer: 0,
    });

    // Advance just under the frame duration
    updateCharacter(ch, WALK_FRAME_DURATION - 0.01, tileMap);
    expect(ch.frame).toBe(0);

    // Push past the frame duration
    updateCharacter(ch, 0.02, tileMap);
    expect(ch.frame).toBe(1);
  });

  it('walk animation frames cycle 0, 1, 2, 3, 0, 1...', () => {
    const ch = makeCharacter({
      state: 'walk',
      // Long path so character keeps walking
      path: Array.from({ length: 100 }, (_, i) => ({ col: 6 + i, row: 5 })),
      speed: WALK_SPEED,
      frame: 0,
      frameTimer: 0,
    });

    const frames: number[] = [ch.frame];
    for (let i = 0; i < 8; i++) {
      updateCharacter(ch, WALK_FRAME_DURATION + 0.001, tileMap);
      frames.push(ch.frame);
    }

    // Should see cycling 0, 1, 2, 3, 0, 1, 2, 3, 0
    expect(frames).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
  });

  it('updates direction based on movement vector (moving right -> direction="right")', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      path: [{ col: 6, row: 5 }],
      speed: WALK_SPEED,
      moveProgress: 0,
      direction: 'down',
    });
    updateCharacter(ch, 0.01, tileMap);
    expect(ch.direction).toBe('right');
  });

  it('updates direction to left when moving left', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      path: [{ col: 4, row: 5 }],
      speed: WALK_SPEED,
      moveProgress: 0,
      direction: 'down',
    });
    updateCharacter(ch, 0.01, tileMap);
    expect(ch.direction).toBe('left');
  });

  it('updates direction to up when moving up', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      path: [{ col: 5, row: 4 }],
      speed: WALK_SPEED,
      moveProgress: 0,
      direction: 'down',
    });
    updateCharacter(ch, 0.01, tileMap);
    expect(ch.direction).toBe('up');
  });

  it('updates direction to down when moving down', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      path: [{ col: 5, row: 6 }],
      speed: WALK_SPEED,
      moveProgress: 0,
      direction: 'up',
    });
    updateCharacter(ch, 0.01, tileMap);
    expect(ch.direction).toBe('down');
  });

  it('interpolates pixel position (x, y) between current tile and next tile', () => {
    const ch = makeCharacter({
      state: 'walk',
      tileCol: 5,
      tileRow: 5,
      x: 5 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      path: [{ col: 6, row: 5 }],
      speed: WALK_SPEED,
      moveProgress: 0,
    });
    // Advance a small dt
    updateCharacter(ch, 0.05, tileMap);
    // x should be between 5*TILE_SIZE and 6*TILE_SIZE
    expect(ch.x).toBeGreaterThan(5 * TILE_SIZE);
    expect(ch.x).toBeLessThan(6 * TILE_SIZE);
    // y should stay at 5*TILE_SIZE (no vertical movement)
    expect(ch.y).toBe(5 * TILE_SIZE);
  });
});

// ── updateCharacter: work state ─────────────────────────────────────────────

describe('updateCharacter - work state', () => {
  let updateCharacter: typeof import('../characters').updateCharacter;
  let tileMap: TileType[][];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../characters');
    updateCharacter = mod.updateCharacter;
    tileMap = createTileMap(20, 20, TileType.FLOOR);
  });

  it('cycles frames every WORK_FRAME_DURATION seconds', () => {
    const ch = makeCharacter({
      state: 'work',
      frame: 0,
      frameTimer: 0,
    });

    updateCharacter(ch, WORK_FRAME_DURATION - 0.01, tileMap);
    expect(ch.frame).toBe(0);

    updateCharacter(ch, 0.02, tileMap);
    expect(ch.frame).toBe(1);
  });

  it('does not change position', () => {
    const ch = makeCharacter({
      state: 'work',
      tileCol: 10,
      tileRow: 10,
      x: 10 * TILE_SIZE,
      y: 10 * TILE_SIZE,
    });
    updateCharacter(ch, 1.0, tileMap);
    expect(ch.tileCol).toBe(10);
    expect(ch.tileRow).toBe(10);
    expect(ch.x).toBe(10 * TILE_SIZE);
    expect(ch.y).toBe(10 * TILE_SIZE);
  });
});

// ── updateCharacter: idle state ─────────────────────────────────────────────

describe('updateCharacter - idle state', () => {
  let updateCharacter: typeof import('../characters').updateCharacter;
  let tileMap: TileType[][];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../characters');
    updateCharacter = mod.updateCharacter;
    tileMap = createTileMap(20, 20, TileType.FLOOR);
  });

  it('does not change frame', () => {
    const ch = makeCharacter({
      state: 'idle',
      frame: 2,
      frameTimer: 0,
    });
    updateCharacter(ch, 1.0, tileMap);
    expect(ch.frame).toBe(2);
  });

  it('does not change position', () => {
    const ch = makeCharacter({
      state: 'idle',
      tileCol: 5,
      tileRow: 5,
      x: 5 * TILE_SIZE,
      y: 5 * TILE_SIZE,
    });
    updateCharacter(ch, 1.0, tileMap);
    expect(ch.x).toBe(5 * TILE_SIZE);
    expect(ch.y).toBe(5 * TILE_SIZE);
  });
});

// ── startWalk ───────────────────────────────────────────────────────────────

describe('startWalk', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    vi.resetModules();
    tileMap = createTileMap(20, 20, TileType.FLOOR);
  });

  it('sets character state to walk and assigns path', async () => {
    const billy = makeCharacter({ id: 'billy', tileCol: 5, tileRow: 5, state: 'idle' });

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billy],
          activeRoomId: 'billy',
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [
          { col: 6, row: 5 },
          { col: 7, row: 5 },
          { col: 8, row: 5 },
          { col: 9, row: 5 },
          { col: 10, row: 5 },
        ]),
      };
    });

    const { startWalk } = await import('../characters');
    startWalk('billy', 10, 5, tileMap);

    expect(billy.state).toBe('walk');
    expect(billy.path.length).toBe(5);
    expect(billy.moveProgress).toBe(0);
  });

  it('calculates speed based on path length (short path -> WALK_SPEED)', async () => {
    const billy = makeCharacter({ id: 'billy', tileCol: 5, tileRow: 5 });

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billy],
          activeRoomId: 'billy',
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => [
          { col: 6, row: 5 },
          { col: 7, row: 5 },
          { col: 8, row: 5 },
        ]),
      };
    });

    const { startWalk } = await import('../characters');
    startWalk('billy', 8, 5, tileMap);
    expect(billy.speed).toBe(WALK_SPEED);
  });

  it('calculates speed for long path (> SPEED_RAMP_TILES -> WALK_SPEED_FAST)', async () => {
    const billy = makeCharacter({ id: 'billy', tileCol: 5, tileRow: 5 });

    const longPath: TileCoord[] = [];
    for (let c = 6; c <= 20; c++) {
      longPath.push({ col: c, row: 5 });
    }

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billy],
          activeRoomId: 'billy',
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => longPath),
      };
    });

    const { startWalk } = await import('../characters');
    startWalk('billy', 20, 5, tileMap);
    expect(billy.speed).toBe(WALK_SPEED_FAST);
  });

  it('with empty path (unreachable) keeps character in current state', async () => {
    const billy = makeCharacter({ id: 'billy', tileCol: 5, tileRow: 5, state: 'idle' });

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billy],
          activeRoomId: 'billy',
          setActiveRoom: vi.fn(),
          setBillyPosition: vi.fn(),
        }),
      },
    }));

    vi.doMock('../tileMap', async () => {
      const actual = await vi.importActual<typeof import('../tileMap')>('../tileMap');
      return {
        ...actual,
        findPath: vi.fn(() => []),
      };
    });

    const { startWalk } = await import('../characters');
    startWalk('billy', 99, 99, tileMap);
    expect(billy.state).toBe('idle');
    expect(billy.path).toEqual([]);
  });
});

// ── getCharacterDirection ───────────────────────────────────────────────────

describe('getCharacterDirection', () => {
  let getCharacterDirection: typeof import('../characters').getCharacterDirection;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../characters');
    getCharacterDirection = mod.getCharacterDirection;
  });

  it('returns right when moving right', () => {
    expect(getCharacterDirection(5, 5, 6, 5)).toBe('right');
  });

  it('returns left when moving left', () => {
    expect(getCharacterDirection(5, 5, 4, 5)).toBe('left');
  });

  it('returns up when moving up', () => {
    expect(getCharacterDirection(5, 5, 5, 4)).toBe('up');
  });

  it('returns down when moving down', () => {
    expect(getCharacterDirection(5, 5, 5, 6)).toBe('down');
  });

  it('prioritizes vertical if both axes change (diagonal up-right -> up)', () => {
    expect(getCharacterDirection(5, 5, 6, 4)).toBe('up');
  });

  it('prioritizes vertical if both axes change (diagonal down-left -> down)', () => {
    expect(getCharacterDirection(5, 5, 4, 6)).toBe('down');
  });
});

// ── Speed ramp ──────────────────────────────────────────────────────────────

describe('speed ramp', () => {
  let updateCharacter: typeof import('../characters').updateCharacter;
  let tileMap: TileType[][];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../characters');
    updateCharacter = mod.updateCharacter;
    tileMap = createTileMap(50, 50, TileType.FLOOR);
  });

  it('uses WALK_SPEED for short paths (<= SPEED_RAMP_TILES)', () => {
    const shortPath: TileCoord[] = [];
    for (let c = 6; c <= 6 + SPEED_RAMP_TILES - 1; c++) {
      shortPath.push({ col: c, row: 5 });
    }
    const ch = makeCharacter({
      state: 'walk',
      path: shortPath,
      speed: WALK_SPEED,
    });
    updateCharacter(ch, 0.01, tileMap);
    // Speed should remain WALK_SPEED (updateCharacter does not change speed)
    expect(ch.speed).toBe(WALK_SPEED);
  });

  it('uses WALK_SPEED_FAST for long paths (> SPEED_RAMP_TILES)', () => {
    const longPath: TileCoord[] = [];
    for (let c = 6; c <= 6 + SPEED_RAMP_TILES + 5; c++) {
      longPath.push({ col: c, row: 5 });
    }
    const ch = makeCharacter({
      state: 'walk',
      path: longPath,
      speed: WALK_SPEED_FAST,
    });
    updateCharacter(ch, 0.01, tileMap);
    // Speed should remain WALK_SPEED_FAST
    expect(ch.speed).toBe(WALK_SPEED_FAST);
  });
});

// ── Knock pause and agent facing BILLY ──────────────────────────────────────

describe('updateAllCharacters - knock and agent reactions', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    vi.resetModules();
    tileMap = createTileMap(50, 50, TileType.FLOOR);
  });

  it('when BILLY arrives at an agent room, a knock pause occurs (0.5s idle)', async () => {
    const billyChar = makeCharacter({
      id: 'billy',
      state: 'walk',
      tileCol: 9,
      tileRow: 14,
      x: 9 * TILE_SIZE,
      y: 14 * TILE_SIZE,
      path: [{ col: 9, row: 15 }], // billyStandTile for patrik
      speed: WALK_SPEED,
      moveProgress: 0.99,
    });

    const patrikChar = makeCharacter({
      id: 'patrik',
      state: 'work',
      tileCol: 8,
      tileRow: 15,
      x: 8 * TILE_SIZE,
      y: 15 * TILE_SIZE,
      direction: 'down',
    });

    const setActiveRoom = vi.fn();
    const setBillyPosition = vi.fn();

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billyChar, patrikChar],
          activeRoomId: null,
          setActiveRoom,
          setBillyPosition,
        }),
      },
    }));

    vi.doMock('../officeLayout', () => ({
      ROOMS: [
        {
          id: 'patrik',
          name: "Patrik's Office",
          tileRect: { col: 4, row: 11, width: 10, height: 10 },
          doorTile: { col: 8, row: 11 },
          seatTile: { col: 8, row: 15 },
          billyStandTile: { col: 9, row: 15 },
        },
      ],
      OFFICE_TILE_MAP: tileMap,
      getRoomAtTile: (col: number, row: number) => {
        if (col >= 4 && col < 14 && row >= 11 && row < 21) {
          return {
            id: 'patrik',
            name: "Patrik's Office",
            tileRect: { col: 4, row: 11, width: 10, height: 10 },
            doorTile: { col: 8, row: 11 },
            seatTile: { col: 8, row: 15 },
            billyStandTile: { col: 9, row: 15 },
          };
        }
        return null;
      },
    }));

    const { updateAllCharacters } = await import('../characters');

    // BILLY arrives -- should trigger knock pause
    updateAllCharacters(0.1, tileMap);

    // BILLY should now be idle (knock pause) at the billyStandTile
    expect(billyChar.state).toBe('idle');
    expect(billyChar.tileCol).toBe(9);
    expect(billyChar.tileRow).toBe(15);
  });

  it('agents in work state transition to idle and face BILLY when he enters their room', async () => {
    const billyChar = makeCharacter({
      id: 'billy',
      state: 'walk',
      tileCol: 9,
      tileRow: 14,
      x: 9 * TILE_SIZE,
      y: 14 * TILE_SIZE,
      path: [{ col: 9, row: 15 }],
      speed: WALK_SPEED,
      moveProgress: 0.99,
    });

    const patrikChar = makeCharacter({
      id: 'patrik',
      state: 'work',
      tileCol: 8,
      tileRow: 15,
      x: 8 * TILE_SIZE,
      y: 15 * TILE_SIZE,
      direction: 'down',
    });

    const setActiveRoom = vi.fn();
    const setBillyPosition = vi.fn();

    vi.doMock('@/store/officeStore', () => ({
      useOfficeStore: {
        getState: () => ({
          characters: [billyChar, patrikChar],
          activeRoomId: null,
          setActiveRoom,
          setBillyPosition,
        }),
      },
    }));

    vi.doMock('../officeLayout', () => ({
      ROOMS: [
        {
          id: 'patrik',
          name: "Patrik's Office",
          tileRect: { col: 4, row: 11, width: 10, height: 10 },
          doorTile: { col: 8, row: 11 },
          seatTile: { col: 8, row: 15 },
          billyStandTile: { col: 9, row: 15 },
        },
      ],
      OFFICE_TILE_MAP: tileMap,
      getRoomAtTile: (col: number, row: number) => {
        if (col >= 4 && col < 14 && row >= 11 && row < 21) {
          return {
            id: 'patrik',
            name: "Patrik's Office",
            tileRect: { col: 4, row: 11, width: 10, height: 10 },
            doorTile: { col: 8, row: 11 },
            seatTile: { col: 8, row: 15 },
            billyStandTile: { col: 9, row: 15 },
          };
        }
        return null;
      },
    }));

    const { updateAllCharacters } = await import('../characters');

    updateAllCharacters(0.1, tileMap);

    // Patrik should now be idle and facing BILLY (BILLY is at col 9, Patrik at col 8 -> face right)
    expect(patrikChar.state).toBe('idle');
    expect(patrikChar.direction).toBe('right');
  });
});
