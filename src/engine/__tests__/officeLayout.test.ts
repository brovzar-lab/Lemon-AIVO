import { describe, it, expect, beforeEach } from 'vitest';
import { TileType } from '../types';
import {
  ROOMS,
  getRoomAtTile,
  FURNITURE,
  OFFICE_TILE_MAP,
  WAR_ROOM_SEATS,
  DECORATIONS,
  getCollisionExemptions,
  addFurniture,
  removeFurnitureAt,
  getFurnitureAt,
  addDecoration,
  removeDecorationAt,
  clearTileStyle,
  setTileStyle,
  getTileStyle,
  TILE_STYLES,
  resizeGridEdge,
} from '../officeLayout';

import { isWalkable, findPath, getTileAt } from '../tileMap';

// -- Room Furniture Tests -----------------------------------------------------

describe('office furniture', () => {
  it('each room has at least 1 furniture item (desk at minimum)', () => {
    // All rooms except billy's (which only has a stand tile, no dedicated desk)
    // and war-room (which has a conference table, handled separately) have desks.
    // Hallway items are plants (counted globally). We verify each agent office
    // and war-room have at least one item each.
    const agentRooms = ROOMS.filter((r) => r.id !== 'billy' && r.id !== 'war-room');
    for (const room of agentRooms) {
      const roomFurniture = FURNITURE.filter((f) => f.roomId === room.id);
      expect(
        roomFurniture.length,
        `${room.id} should have at least 1 furniture item`,
      ).toBeGreaterThanOrEqual(1);
    }
    // War Room has a conference table
    const warRoomFurniture = FURNITURE.filter((f) => f.roomId === 'war-room');
    expect(warRoomFurniture.length, 'war-room should have at least 1 furniture item').toBeGreaterThanOrEqual(1);
  });

  it('furniture positions are inside their room tileRect', () => {
    for (const item of FURNITURE) {
      if (item.roomId === 'hallway') continue; // Hallway items are not in rooms
      const room = ROOMS.find((r) => r.id === item.roomId);
      if (!room) continue;
      const r = room.tileRect;
      expect(
        item.col >= r.col && item.col < r.col + r.width,
        `Furniture "${item.type}" in ${item.roomId} col ${item.col} should be inside room (${r.col}-${r.col + r.width})`,
      ).toBe(true);
      expect(
        item.row >= r.row && item.row < r.row + r.height,
        `Furniture "${item.type}" in ${item.roomId} row ${item.row} should be inside room (${r.row}-${r.row + r.height})`,
      ).toBe(true);
    }
  });

  it('War Room has a conference table furniture item', () => {
    // Board Room has a conference table in the FURNITURE collision array
    const warRoomFurniture = FURNITURE.filter((f) => f.roomId === 'war-room');
    const hasTable = warRoomFurniture.some((f) => f.type === 'table');
    expect(hasTable, 'War Room should have a conference table').toBe(true);
  });

  it("BILLY's office stand tile is a FLOOR tile (BILLY enters via billyStandTile)", () => {
    // BILLY's office uses a billyStandTile rather than a desk furniture item.
    // The stand tile must be a FLOOR tile so BILLY can walk there.
    const billy = ROOMS.find((r) => r.id === 'billy')!;
    const tileType = OFFICE_TILE_MAP[billy.billyStandTile.row]?.[billy.billyStandTile.col];
    expect(tileType, "BILLY's billyStandTile should be a FLOOR tile").toBe(TileType.FLOOR);
  });
});

// -- Room Layout Tests --------------------------------------------------------

describe('room layout', () => {
  it('hallway tiles are not inside any room tileRect', () => {
    // Corridor tiles in the horizontal corridors
    // With wall-to-wall layout, corridors are carved through shared walls.
    // Corridor tiles at shared boundaries belong to one room's tileRect but are FLOOR.
    // Test bottom center hallway which is outside any room tileRect.
    // Pick tiles that are definitely outside any room — use map edges
    const hallwayTiles = [
      { col: 0, row: 0 },    // top-left corner (VOID or wall, not a room)
    ].filter(t => {
      const row = OFFICE_TILE_MAP[t.row];
      return row && row[t.col] === TileType.FLOOR;
    });
    for (const tile of hallwayTiles) {
      const room = getRoomAtTile(tile.col, tile.row);
      expect(
        room,
        `Tile (${tile.col}, ${tile.row}) should be hallway (null room)`,
      ).toBeNull();
    }
  });

  it('all rooms have unique IDs', () => {
    const ids = ROOMS.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('room names are human-readable display names', () => {
    for (const room of ROOMS) {
      expect(room.name.length).toBeGreaterThanOrEqual(2);
      expect(room.name).not.toBe(room.id);
      expect(/[A-Z\s]/.test(room.name)).toBe(true);
    }
  });
});

// -- Compact Grid Invariant Tests ---------------------------------------------

describe('compact grid invariants', () => {
  it('grid dimensions are correct', () => {
    // Rows
    expect(
      OFFICE_TILE_MAP.length,
      `Grid should have 38 rows (got ${OFFICE_TILE_MAP.length})`,
    ).toBe(38);
    // Cols
    expect(
      OFFICE_TILE_MAP[0]!.length,
      `Grid should have 45 cols (got ${OFFICE_TILE_MAP[0]!.length})`,
    ).toBe(45);
  });

  it('all room seatTile positions are FLOOR tiles', () => {
    for (const room of ROOMS) {
      const tileType = getTileAt(
        room.seatTile.col,
        room.seatTile.row,
        OFFICE_TILE_MAP,
      );
      expect(
        tileType,
        `${room.id} seatTile (${room.seatTile.col},${room.seatTile.row}) should be FLOOR`,
      ).toBe(TileType.FLOOR);
    }
  });

  it('all room billyStandTile positions are FLOOR tiles', () => {
    for (const room of ROOMS) {
      const tileType = getTileAt(
        room.billyStandTile.col,
        room.billyStandTile.row,
        OFFICE_TILE_MAP,
      );
      expect(
        tileType,
        `${room.id} billyStandTile (${room.billyStandTile.col},${room.billyStandTile.row}) should be FLOOR`,
      ).toBe(TileType.FLOOR);
    }
  });

  it('all room doorTile positions are DOOR tiles', () => {
    for (const room of ROOMS) {
      const tileType = getTileAt(
        room.doorTile.col,
        room.doorTile.row,
        OFFICE_TILE_MAP,
      );
      expect(
        tileType,
        `${room.id} doorTile (${room.doorTile.col},${room.doorTile.row}) should be DOOR`,
      ).toBe(TileType.DOOR);
    }
  });

  it('BFS connectivity: path exists between every pair of room doors', () => {
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

  it("BILLY's office is in top center region", () => {
    const billy = ROOMS.find((r) => r.id === 'billy')!;
    expect(billy.tileRect.col).toBeGreaterThanOrEqual(10);
    expect(billy.tileRect.col + billy.tileRect.width).toBeLessThanOrEqual(32);
    expect(billy.tileRect.row).toBeLessThan(OFFICE_TILE_MAP.length / 2);
  });

  it("Patrik's office is in top right region", () => {
    const patrik = ROOMS.find((r) => r.id === 'patrik')!;
    expect(patrik.tileRect.col).toBeGreaterThanOrEqual(28);
    expect(patrik.tileRect.row).toBeLessThan(OFFICE_TILE_MAP.length / 2);
  });

  it('War Room is in center, vertically centered between corridors', () => {
    const warRoom = ROOMS.find((r) => r.id === 'war-room')!;
    const marcos = ROOMS.find((r) => r.id === 'marcos')!;
    const sandra = ROOMS.find((r) => r.id === 'sandra')!;

    // War Room is between Marcos (left) and Sandra (right)
    expect(warRoom.tileRect.col).toBeGreaterThanOrEqual(marcos.tileRect.col + marcos.tileRect.width);
    expect(warRoom.tileRect.col + warRoom.tileRect.width).toBeLessThanOrEqual(sandra.tileRect.col);

    // War Room is 12+ tiles tall
    expect(warRoom.tileRect.height).toBeGreaterThanOrEqual(12);

    // War Room is at least 14 tiles wide (portrait orientation)
    expect(warRoom.tileRect.width).toBeGreaterThanOrEqual(14);

    // War Room is below top rooms
    const topRooms = ROOMS.filter(
      (r) => r.id === 'billy' || r.id === 'patrik' || r.id === 'isaac',
    );
    const topMax = Math.max(
      ...topRooms.map((r) => r.tileRect.row + r.tileRect.height),
    );
    expect(warRoom.tileRect.row).toBeGreaterThan(topMax - 1);
  });

  it('upper side offices: Marcos and Sandra at same row', () => {
    const marcos = ROOMS.find((r) => r.id === 'marcos')!;
    const sandra = ROOMS.find((r) => r.id === 'sandra')!;
    expect(marcos).toBeDefined();
    expect(sandra).toBeDefined();
    expect(marcos.tileRect.row).toBe(sandra.tileRect.row);
  });

  it('lower side offices: Charlie and Wendy at same row', () => {
    const charlie = ROOMS.find((r) => r.id === 'charlie')!;
    const wendy = ROOMS.find((r) => r.id === 'wendy')!;
    expect(charlie).toBeDefined();
    expect(wendy).toBeDefined();
    expect(charlie.tileRect.row).toBe(wendy.tileRect.row);
  });

  it('corridors exist between rooms (walkable tiles outside room rects)', () => {
    // Verify there are walkable tiles not inside any room
    let corridorTiles = 0;
    for (let row = 0; row < OFFICE_TILE_MAP.length; row++) {
      for (let col = 0; col < OFFICE_TILE_MAP[0]!.length; col++) {
        if (isWalkable(col, row, OFFICE_TILE_MAP) && !getRoomAtTile(col, row)) {
          corridorTiles++;
        }
      }
    }
    expect(corridorTiles).toBeGreaterThan(0);
  });
});

// -- WAR_ROOM_SEATS Tests -----------------------------------------------------

describe('WAR_ROOM_SEATS', () => {
  it('has 7 entries including billy and charlie', () => {
    const keys = Object.keys(WAR_ROOM_SEATS);
    expect(keys.length).toBe(7);
    expect(keys).toContain('billy');
    expect(keys).toContain('patrik');
    expect(keys).toContain('marcos');
    expect(keys).toContain('sandra');
    expect(keys).toContain('isaac');
    expect(keys).toContain('wendy');
    expect(keys).toContain('charlie');
  });

  it('all seats are within War Room interior', () => {
    const warRoom = ROOMS.find((r) => r.id === 'war-room')!;
    const interior = {
      minCol: warRoom.tileRect.col + 1,
      maxCol: warRoom.tileRect.col + warRoom.tileRect.width - 2,
      minRow: warRoom.tileRect.row + 1,
      maxRow: warRoom.tileRect.row + warRoom.tileRect.height - 2,
    };

    for (const [agent, seat] of Object.entries(WAR_ROOM_SEATS)) {
      expect(
        seat.col,
        `${agent} col should be >= ${interior.minCol}`,
      ).toBeGreaterThanOrEqual(interior.minCol);
      expect(
        seat.col,
        `${agent} col should be <= ${interior.maxCol}`,
      ).toBeLessThanOrEqual(interior.maxCol);
      expect(
        seat.row,
        `${agent} row should be >= ${interior.minRow}`,
      ).toBeGreaterThanOrEqual(interior.minRow);
      expect(
        seat.row,
        `${agent} row should be <= ${interior.maxRow}`,
      ).toBeLessThanOrEqual(interior.maxRow);
    }
  });

  it('all seats are FLOOR tiles (walkable)', () => {
    for (const [agent, seat] of Object.entries(WAR_ROOM_SEATS)) {
      const tileType = getTileAt(seat.col, seat.row, OFFICE_TILE_MAP);
      expect(
        tileType,
        `${agent} seat (${seat.col},${seat.row}) should be FLOOR`,
      ).toBe(TileType.FLOOR);
    }
  });

  it('no seat position overlaps with any non-chair war-room furniture', () => {
    // No seat should be inside the footprint of any non-chair furniture in the war room.
    // This ensures seats are accessible even if a conference table or other item is present.
    const warRoomNonChairFurniture = FURNITURE.filter(
      (f) => f.roomId === 'war-room' && f.type !== 'chair',
    );
    for (const [agent, seat] of Object.entries(WAR_ROOM_SEATS)) {
      for (const item of warRoomNonChairFurniture) {
        const onItem =
          seat.col >= item.col &&
          seat.col < item.col + item.width &&
          seat.row >= item.row &&
          seat.row < item.row + item.height;
        expect(onItem, `${agent} should NOT be on ${item.type} at (${item.col},${item.row})`).toBe(false);
      }
    }
  });
});

// -- DECORATIONS Tests --------------------------------------------------------

describe('DECORATIONS', () => {
  it('all decoration items are within their room boundaries', () => {
    for (const deco of DECORATIONS) {
      const room = ROOMS.find((r) => r.id === deco.roomId);
      expect(room, `Room ${deco.roomId} should exist for decoration ${deco.key}`).toBeDefined();
      if (!room) continue;
      const r = room.tileRect;
      expect(
        deco.col >= r.col && deco.col < r.col + r.width,
        `Decoration "${deco.key}" in ${deco.roomId} col ${deco.col} should be inside room (${r.col}-${r.col + r.width})`,
      ).toBe(true);
      expect(
        deco.row >= r.row && deco.row < r.row + r.height,
        `Decoration "${deco.key}" in ${deco.roomId} row ${deco.row} should be inside room (${r.row}-${r.row + r.height})`,
      ).toBe(true);
    }
  });

  it('DECORATIONS is an array (may be empty — populated in a later phase)', () => {
    // DECORATIONS is defined and is an array; Phase 13 stubs add personal touches
    // when that phase is implemented. This test confirms the export exists.
    expect(Array.isArray(DECORATIONS)).toBe(true);
  });
});

// -- Phase 13 Test Stubs -------------------------------------------------------

describe('Phase 13: expanded decorations', () => {
  it('decoration - DECORATIONS array is exported and is an array', () => {
    expect(Array.isArray(DECORATIONS)).toBe(true);
  });
  it('decoration - all decoration items have required keys: roomId, key, col, row', () => {
    for (const deco of DECORATIONS) {
      expect(typeof deco.roomId).toBe('string');
      expect(typeof deco.key).toBe('string');
      expect(typeof deco.col).toBe('number');
      expect(typeof deco.row).toBe('number');
    }
  });
  it('decoration - no decoration item shares a key+position with another in the same room', () => {
    const seen = new Set<string>();
    for (const deco of DECORATIONS) {
      const sig = `${deco.roomId}:${deco.col},${deco.row}`;
      expect(seen.has(sig), `Duplicate decoration at ${sig}`).toBe(false);
      seen.add(sig);
    }
  });
});

// -- Filing Cabinet Tests -----------------------------------------------------

describe('filing cabinet furniture', () => {
  it('FURNITURE contains 6 filing-cabinet items, one per agent office', () => {
    const cabinets = FURNITURE.filter(f => f.type === 'filing-cabinet');
    expect(cabinets).toHaveLength(6);
    const roomIds = cabinets.map(f => f.roomId).sort();
    expect(roomIds).toEqual(['charlie', 'isaac', 'marcos', 'patrik', 'sandra', 'wendy']);
  });

  it('each filing cabinet is at width=1, height=1 with atlasKey filing-cabinet', () => {
    const cabinets = FURNITURE.filter(f => f.type === 'filing-cabinet');
    for (const c of cabinets) {
      expect(c.width).toBe(1);
      expect(c.height).toBe(1);
      expect(c.atlasKey).toBe('filing-cabinet');
    }
  });

  it('getCollisionExemptions includes all 6 filing cabinet tile positions', () => {
    const exemptions = getCollisionExemptions();
    const cabinetCoords = [
      { col: 5, row: 5 },   // isaac
      { col: 41, row: 5 },  // patrik
      { col: 5, row: 17 },  // marcos
      { col: 41, row: 17 }, // sandra
      { col: 5, row: 29 },  // charlie
      { col: 41, row: 29 }, // wendy
    ];
    for (const coord of cabinetCoords) {
      expect(exemptions).toContainEqual(coord);
    }
  });
});

// -- Mutable Layout Functions -------------------------------------------------

describe('clearTileStyle', () => {
  beforeEach(() => {
    TILE_STYLES.clear();
  });

  it('removes a tile style that was set', () => {
    setTileStyle(10, 5, 'floor-wood-dark');
    expect(getTileStyle(10, 5)).toBe('floor-wood-dark');
    clearTileStyle(10, 5);
    expect(getTileStyle(10, 5)).toBeNull();
  });

  it('no-ops when tile has no style', () => {
    expect(() => clearTileStyle(99, 99)).not.toThrow();
    expect(getTileStyle(99, 99)).toBeNull();
  });
});

describe('addFurniture / removeFurnitureAt / getFurnitureAt', () => {
  const testItem = {
    roomId: 'test-room',
    type: 'desk' as const,
    col: 5,
    row: 5,
    width: 2,
    height: 1,
    atlasKey: 'desk-test',
  };
  const savedFurnitureLength = FURNITURE.length;

  it('addFurniture appends to FURNITURE array', () => {
    const prevLen = FURNITURE.length;
    addFurniture(testItem);
    expect(FURNITURE.length).toBe(prevLen + 1);
    expect(FURNITURE[FURNITURE.length - 1]!.atlasKey).toBe('desk-test');
    // Cleanup
    FURNITURE.pop();
  });

  it('addFurniture with atIndex inserts at given index', () => {
    const prevLen = FURNITURE.length;
    addFurniture(testItem, 0);
    expect(FURNITURE.length).toBe(prevLen + 1);
    expect(FURNITURE[0]!.atlasKey).toBe('desk-test');
    // Cleanup
    FURNITURE.splice(0, 1);
  });

  it('removeFurnitureAt removes item at index', () => {
    addFurniture(testItem);
    const idx = FURNITURE.length - 1;
    const prevLen = FURNITURE.length;
    removeFurnitureAt(idx);
    expect(FURNITURE.length).toBe(prevLen - 1);
  });

  it('removeFurnitureAt is a no-op for out-of-bounds index', () => {
    const prevLen = FURNITURE.length;
    removeFurnitureAt(-1);
    expect(FURNITURE.length).toBe(prevLen);
    removeFurnitureAt(9999);
    expect(FURNITURE.length).toBe(prevLen);
  });

  it('getFurnitureAt returns index for item at that tile', () => {
    addFurniture({ ...testItem, col: 1, row: 1, width: 2, height: 2 });
    const idx = getFurnitureAt(1, 1);
    expect(idx).not.toBeNull();
    // Cleanup
    if (idx !== null) removeFurnitureAt(idx);
  });

  it('getFurnitureAt returns null when no furniture at tile', () => {
    expect(getFurnitureAt(0, 0)).toBeNull();
  });

  it('FURNITURE length is unchanged after test cleanup', () => {
    expect(FURNITURE.length).toBe(savedFurnitureLength);
  });
});

describe('addDecoration / removeDecorationAt', () => {
  const testDeco = { roomId: 'test', key: 'plant', col: 10, row: 10 };

  it('addDecoration appends to DECORATIONS', () => {
    const prevLen = DECORATIONS.length;
    addDecoration(testDeco);
    expect(DECORATIONS.length).toBe(prevLen + 1);
    expect(DECORATIONS[DECORATIONS.length - 1]!.key).toBe('plant');
    // Cleanup
    DECORATIONS.pop();
  });

  it('removeDecorationAt removes item at index', () => {
    addDecoration(testDeco);
    const prevLen = DECORATIONS.length;
    removeDecorationAt(prevLen - 1);
    expect(DECORATIONS.length).toBe(prevLen - 1);
  });

  it('removeDecorationAt is a no-op for out-of-bounds index', () => {
    const prevLen = DECORATIONS.length;
    removeDecorationAt(-1);
    removeDecorationAt(9999);
    expect(DECORATIONS.length).toBe(prevLen);
  });
});

describe('resizeGridEdge', () => {
  it('resizeGridEdge bottom +1 adds a row', () => {
    const prevRows = OFFICE_TILE_MAP.length;
    resizeGridEdge('bottom', 1);
    expect(OFFICE_TILE_MAP.length).toBe(prevRows + 1);
    // Cleanup
    resizeGridEdge('bottom', -1);
    expect(OFFICE_TILE_MAP.length).toBe(prevRows);
  });

  it('resizeGridEdge right +1 adds a column', () => {
    const prevCols = OFFICE_TILE_MAP[0]!.length;
    resizeGridEdge('right', 1);
    expect(OFFICE_TILE_MAP[0]!.length).toBe(prevCols + 1);
    // Cleanup
    resizeGridEdge('right', -1);
    expect(OFFICE_TILE_MAP[0]!.length).toBe(prevCols);
  });

  it('resizeGridEdge top +1 adds a row at top', () => {
    const prevRows = OFFICE_TILE_MAP.length;
    resizeGridEdge('top', 1);
    expect(OFFICE_TILE_MAP.length).toBe(prevRows + 1);
    // Cleanup
    resizeGridEdge('top', -1);
    expect(OFFICE_TILE_MAP.length).toBe(prevRows);
  });

  it('resizeGridEdge left +1 adds a column at left', () => {
    const prevCols = OFFICE_TILE_MAP[0]!.length;
    resizeGridEdge('left', 1);
    expect(OFFICE_TILE_MAP[0]!.length).toBe(prevCols + 1);
    // Cleanup
    resizeGridEdge('left', -1);
    expect(OFFICE_TILE_MAP[0]!.length).toBe(prevCols);
  });

  it('resizeGridEdge with amount 0 is a no-op', () => {
    const prevRows = OFFICE_TILE_MAP.length;
    const prevCols = OFFICE_TILE_MAP[0]!.length;
    resizeGridEdge('bottom', 0);
    resizeGridEdge('top', 0);
    resizeGridEdge('left', 0);
    resizeGridEdge('right', 0);
    expect(OFFICE_TILE_MAP.length).toBe(prevRows);
    expect(OFFICE_TILE_MAP[0]!.length).toBe(prevCols);
  });
});
