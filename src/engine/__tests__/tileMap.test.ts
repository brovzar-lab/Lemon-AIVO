import { describe, it, expect, afterEach } from 'vitest';
import { TileType } from '../types';
import type { TileCoord } from '../types';
import {
  isWalkable,
  findPath,
  getTileAt,
  createTileMap,
  // @ts-expect-error -- these exports do not exist yet (RED phase — Wave 1 will add them)
  rebuildCollisionOverlay,
  // @ts-expect-error -- these exports do not exist yet (RED phase — Wave 1 will add them)
  getCollisionAt,
  // @ts-expect-error -- these exports do not exist yet (RED phase — Wave 1 will add them)
  resetCollisionOverlay,
} from '../tileMap';
import { OFFICE_TILE_MAP, ROOMS, WAR_ROOM_SEATS, getRoomAtTile } from '../officeLayout';
import type { FurnitureItem } from '../officeLayout';

// ── getTileAt ───────────────────────────────────────────────────────────────

describe('getTileAt', () => {
  const map = createTileMap(3, 3, TileType.FLOOR);

  it('returns tile at valid position', () => {
    expect(getTileAt(1, 1, map)).toBe(TileType.FLOOR);
  });

  it('returns VOID for negative col', () => {
    expect(getTileAt(-1, 0, map)).toBe(TileType.VOID);
  });

  it('returns VOID for negative row', () => {
    expect(getTileAt(0, -1, map)).toBe(TileType.VOID);
  });

  it('returns VOID for col out of bounds', () => {
    expect(getTileAt(3, 0, map)).toBe(TileType.VOID);
  });

  it('returns VOID for row out of bounds', () => {
    expect(getTileAt(0, 3, map)).toBe(TileType.VOID);
  });
});

// ── isWalkable ──────────────────────────────────────────────────────────────

describe('isWalkable', () => {
  // Build a small map with all tile types
  const map: TileType[][] = [
    [TileType.FLOOR, TileType.WALL, TileType.DOOR, TileType.VOID],
  ];

  it('returns true for FLOOR', () => {
    expect(isWalkable(0, 0, map)).toBe(true);
  });

  it('returns false for WALL', () => {
    expect(isWalkable(1, 0, map)).toBe(false);
  });

  it('returns true for DOOR', () => {
    expect(isWalkable(2, 0, map)).toBe(true);
  });

  it('returns false for VOID', () => {
    expect(isWalkable(3, 0, map)).toBe(false);
  });

  it('returns false for out-of-bounds', () => {
    expect(isWalkable(-1, 0, map)).toBe(false);
    expect(isWalkable(0, -1, map)).toBe(false);
    expect(isWalkable(4, 0, map)).toBe(false);
    expect(isWalkable(0, 1, map)).toBe(false);
  });
});

// ── findPath ────────────────────────────────────────────────────────────────

describe('findPath', () => {
  it('finds shortest path on a simple 5x5 grid', () => {
    const map = createTileMap(5, 5, TileType.FLOOR);
    const path = findPath(0, 0, 4, 4, map);
    // Manhattan distance is 8, so path length should be 8
    expect(path.length).toBe(8);
    // End should be the last tile
    expect(path[path.length - 1]).toEqual({ col: 4, row: 4 });
  });

  it('returns empty array when no path exists (blocked by walls)', () => {
    // Create a 5x5 map with a wall barrier across the middle
    const map = createTileMap(5, 5, TileType.FLOOR);
    for (let c = 0; c < 5; c++) {
      map[2]![c] = TileType.WALL;
    }
    const path = findPath(0, 0, 0, 4, map);
    expect(path).toEqual([]);
  });

  it('navigates around walls', () => {
    // 5x5 grid with partial wall
    const map = createTileMap(5, 5, TileType.FLOOR);
    // Wall from col 0-3 at row 2 (leaving col 4 open)
    for (let c = 0; c < 4; c++) {
      map[2]![c] = TileType.WALL;
    }
    const path = findPath(0, 0, 0, 4, map);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ col: 0, row: 4 });
    // Path must go around the wall through col 4
    const goesRight = path.some((p) => p.col === 4);
    expect(goesRight).toBe(true);
  });

  it('returns empty array when destination is a wall', () => {
    const map = createTileMap(3, 3, TileType.FLOOR);
    map[2]![2] = TileType.WALL;
    const path = findPath(0, 0, 2, 2, map);
    expect(path).toEqual([]);
  });

  it('returns empty array when start equals end', () => {
    const map = createTileMap(3, 3, TileType.FLOOR);
    const path = findPath(1, 1, 1, 1, map);
    expect(path).toEqual([]);
  });

  it('can navigate through DOOR tiles', () => {
    const map = createTileMap(5, 1, TileType.FLOOR);
    map[0]![2] = TileType.DOOR;
    const path = findPath(0, 0, 4, 0, map);
    expect(path.length).toBe(4);
    expect(path[1]).toEqual({ col: 2, row: 0 }); // Goes through the door
  });
});

// ── Office Layout ───────────────────────────────────────────────────────────

describe('OFFICE_TILE_MAP', () => {
  it('has exactly 8 rooms (7 offices + board room)', () => {
    expect(ROOMS.length).toBe(8);
  });

  it('has expected room IDs', () => {
    const ids = ROOMS.map((r) => r.id).sort();
    expect(ids).toEqual([
      'billy',
      'charlie',
      'isaac',
      'marcos',
      'patrik',
      'sandra',
      'war-room',
      'wendy',
    ]);
  });

  it('every room doorTile is walkable', () => {
    for (const room of ROOMS) {
      const walkable = isWalkable(
        room.doorTile.col,
        room.doorTile.row,
        OFFICE_TILE_MAP,
      );
      expect(walkable, `${room.id} doorTile should be walkable`).toBe(true);
    }
  });

  it('every room seatTile is inside the room tileRect', () => {
    for (const room of ROOMS) {
      const r = room.tileRect;
      const s = room.seatTile;
      expect(
        s.col >= r.col && s.col < r.col + r.width,
        `${room.id} seatTile col should be inside tileRect`,
      ).toBe(true);
      expect(
        s.row >= r.row && s.row < r.row + r.height,
        `${room.id} seatTile row should be inside tileRect`,
      ).toBe(true);
    }
  });

  it('every room seatTile is walkable', () => {
    for (const room of ROOMS) {
      const walkable = isWalkable(
        room.seatTile.col,
        room.seatTile.row,
        OFFICE_TILE_MAP,
      );
      expect(walkable, `${room.id} seatTile should be walkable`).toBe(true);
    }
  });

  it('findPath can reach every room doorTile from BILLY starting position', () => {
    const billyRoom = ROOMS.find((r) => r.id === 'billy')!;
    const billySeat = billyRoom.seatTile;

    for (const room of ROOMS) {
      if (room.id === 'billy') continue;
      const path = findPath(
        billySeat.col,
        billySeat.row,
        room.doorTile.col,
        room.doorTile.row,
        OFFICE_TILE_MAP,
      );
      expect(
        path.length,
        `Should find path from BILLY to ${room.id} door`,
      ).toBeGreaterThan(0);
    }
  });

  it('findPath can navigate between all room pairs', () => {
    for (const roomA of ROOMS) {
      for (const roomB of ROOMS) {
        if (roomA.id === roomB.id) continue;
        const path = findPath(
          roomA.doorTile.col,
          roomA.doorTile.row,
          roomB.doorTile.col,
          roomB.doorTile.row,
          OFFICE_TILE_MAP,
        );
        expect(
          path.length,
          `Should find path from ${roomA.id} to ${roomB.id}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

// ── getRoomAtTile ───────────────────────────────────────────────────────────

describe('getRoomAtTile', () => {
  it('returns correct room for a tile inside each room', () => {
    for (const room of ROOMS) {
      const r = room.tileRect;
      // Check center tile of each room
      const centerCol = r.col + Math.floor(r.width / 2);
      const centerRow = r.row + Math.floor(r.height / 2);
      const found = getRoomAtTile(centerCol, centerRow);
      expect(found?.id, `Center of ${room.id} should map back`).toBe(room.id);
    }
  });

  it('returns null for tiles outside all room rects', () => {
    // Top-left corner of the map should not be inside any room
    const result = getRoomAtTile(0, 0);
    expect(result).toBeNull();
  });
});

// ── collisionOverlay ─────────────────────────────────────────────────────────
// RED phase: rebuildCollisionOverlay, getCollisionAt, resetCollisionOverlay are
// not yet exported from tileMap.ts. These tests will fail with "is not a
// function" or import errors until Wave 1 (15-02) adds the implementation.

describe('collisionOverlay', () => {
  // Tiny synthetic 5×5 all-FLOOR map — keeps these tests isolated from the
  // real office layout so failures are deterministic.
  const map5x5 = createTileMap(5, 5, TileType.FLOOR);

  // Solid furniture item occupying tile (2, 2)
  const solidDesk: FurnitureItem = {
    roomId: 'test',
    type: 'desk',
    col: 2,
    row: 2,
    width: 1,
    height: 1,
  };

  // Passable furniture item occupying tile (0, 0) — should NOT block movement
  const passablePlant: FurnitureItem = {
    roomId: 'test',
    type: 'plant',
    col: 0,
    row: 0,
    width: 1,
    height: 1,
  };

  // Chair at tile (3, 3) — solid type, but seatTile exemption clears it
  const chairAtSeat: FurnitureItem = {
    roomId: 'test',
    type: 'chair',
    col: 3,
    row: 3,
    width: 1,
    height: 1,
  };

  afterEach(() => {
    // Prevent test bleed — clear the module-scoped overlay between tests
    resetCollisionOverlay();
  });

  it('marks a solid furniture tile as blocked after rebuild', () => {
    rebuildCollisionOverlay([solidDesk], [], map5x5.length, map5x5[0]!.length);
    expect(getCollisionAt(2, 2)).toBe(true);
  });

  it('does NOT mark a passable furniture tile as blocked', () => {
    rebuildCollisionOverlay(
      [passablePlant],
      [],
      map5x5.length,
      map5x5[0]!.length,
    );
    expect(getCollisionAt(0, 0)).toBe(false);
  });

  it('isWalkable returns false when overlay blocks a FLOOR tile', () => {
    rebuildCollisionOverlay([solidDesk], [], map5x5.length, map5x5[0]!.length);
    expect(isWalkable(2, 2, map5x5)).toBe(false);
  });

  it('isWalkable returns true on a FLOOR tile not blocked by overlay', () => {
    rebuildCollisionOverlay([solidDesk], [], map5x5.length, map5x5[0]!.length);
    expect(isWalkable(1, 1, map5x5)).toBe(true);
  });

  it('seat tile exemption: chair at seatTile stays walkable after rebuild', () => {
    const seatExemption: TileCoord = { col: 3, row: 3 };
    rebuildCollisionOverlay(
      [chairAtSeat],
      [seatExemption],
      map5x5.length,
      map5x5[0]!.length,
    );
    // Without exemption the chair would block (3,3); the exemption clears it
    expect(getCollisionAt(3, 3)).toBe(false);
    expect(isWalkable(3, 3, map5x5)).toBe(true);
  });

  it('resetCollisionOverlay clears all blocks', () => {
    rebuildCollisionOverlay([solidDesk], [], map5x5.length, map5x5[0]!.length);
    expect(getCollisionAt(2, 2)).toBe(true); // sanity check
    resetCollisionOverlay();
    expect(getCollisionAt(2, 2)).toBe(false);
  });
});

// ── Water cooler stand tile (IDLE-02) ────────────────────────────────────────
// Verifies the BFS destination tile for water cooler trips is walkable.
// The cooler furniture itself sits at (16, 31) — a solid tile after collision
// overlay is applied. The stand tile one row south (16, 32) must be hallway
// FLOOR so agents can navigate there via startWalk.

describe('water cooler stand tile (IDLE-02)', () => {
  it('isWalkable(16, 32, OFFICE_TILE_MAP) returns true (stand tile is walkable hallway floor)', () => {
    expect(isWalkable(16, 32, OFFICE_TILE_MAP)).toBe(true);
  });
});

// ── War Room path reachability (COLL-04) ─────────────────────────────────────
// These tests verify that each agent can reach their assigned War Room seat
// from their own office seatTile using the structural OFFICE_TILE_MAP.
// rebuildCollisionOverlay is intentionally NOT called here — these tests check
// structural walkability before any furniture collision is applied.

describe('War Room path reachability (COLL-04)', () => {
  // The 5 agents that travel to War Room seats (billy uses his own seatTile, wendy stays at her desk)
  const AGENT_IDS = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];

  it('findPath from each agent seatTile to their WAR_ROOM_SEAT returns non-empty path', () => {
    for (const agentId of AGENT_IDS) {
      const room = ROOMS.find((r) => r.id === agentId);
      expect(room, `Room not found for agent: ${agentId}`).toBeDefined();
      const warSeat = WAR_ROOM_SEATS[agentId];
      expect(warSeat, `WAR_ROOM_SEAT not found for agent: ${agentId}`).toBeDefined();

      const path = findPath(
        room!.seatTile.col,
        room!.seatTile.row,
        warSeat!.col,
        warSeat!.row,
        OFFICE_TILE_MAP,
      );
      expect(
        path.length,
        `${agentId}: expected non-empty path from seatTile (${room!.seatTile.col},${room!.seatTile.row}) to War Room seat (${warSeat!.col},${warSeat!.row})`,
      ).toBeGreaterThan(0);
    }
  });

  it('all 6 WAR_ROOM_SEATS are walkable in the structural tile map', () => {
    for (const [agentId, seat] of Object.entries(WAR_ROOM_SEATS)) {
      expect(
        isWalkable(seat.col, seat.row, OFFICE_TILE_MAP),
        `WAR_ROOM_SEAT for ${agentId} at (${seat.col},${seat.row}) should be walkable`,
      ).toBe(true);
    }
  });
});
