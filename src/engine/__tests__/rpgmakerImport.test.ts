/**
 * Unit tests for the RPG Maker MZ → Lemon AIVO map converter.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyTileId,
  isRPGMakerMap,
  parseEvents,
  convertRPGMakerMap,
} from '../rpgmakerImport';
import type { RPGMakerMap, RPGMakerEvent } from '../rpgmakerImport';

// ── Helper: Create a minimal RPG Maker map ────────────────────────────────

function makeMap(
  width: number,
  height: number,
  overrides?: Partial<RPGMakerMap>,
): RPGMakerMap {
  const layerSize = width * height;
  const data = new Array(layerSize * 6).fill(0);
  return {
    width,
    height,
    tilesetId: 1,
    data,
    events: [null], // index 0 is always null in RPG Maker
    ...overrides,
  };
}

/** Set a tile ID at (x, y) on layer z. */
function setTile(map: RPGMakerMap, x: number, y: number, z: number, tileId: number): void {
  const idx = z * (map.width * map.height) + y * map.width + x;
  map.data[idx] = tileId;
}

/** Set the region ID at (x, y) (layer 5). */
function setRegion(map: RPGMakerMap, x: number, y: number, regionId: number): void {
  setTile(map, x, y, 5, regionId);
}

// ── Tile Classification ───────────────────────────────────────────────────

describe('classifyTileId', () => {
  it('returns VOID (0) for empty tile', () => {
    expect(classifyTileId(0)).toBe(0);
  });

  it('returns VOID (0) for A1 water tiles (2048-2815)', () => {
    expect(classifyTileId(2048)).toBe(0);
    expect(classifyTileId(2500)).toBe(0);
    expect(classifyTileId(2815)).toBe(0);
  });

  it('returns FLOOR (1) for A2 ground tiles (2816-4351)', () => {
    expect(classifyTileId(2816)).toBe(1);
    expect(classifyTileId(3500)).toBe(1);
    expect(classifyTileId(4351)).toBe(1);
  });

  it('returns WALL (2) for A3 wall tiles (4352-5887)', () => {
    expect(classifyTileId(4352)).toBe(2);
    expect(classifyTileId(5000)).toBe(2);
    expect(classifyTileId(5887)).toBe(2);
  });

  it('returns WALL (2) for A4 wall-top tiles (5888-8191)', () => {
    expect(classifyTileId(5888)).toBe(2);
    expect(classifyTileId(7000)).toBe(2);
    expect(classifyTileId(8191)).toBe(2);
  });

  it('returns FLOOR (1) for B-E normal tiles (≥8192)', () => {
    expect(classifyTileId(8192)).toBe(1);
    expect(classifyTileId(10000)).toBe(1);
  });

  it('returns FLOOR (1) for low-range tiles (1-1535)', () => {
    expect(classifyTileId(1)).toBe(1);
    expect(classifyTileId(1000)).toBe(1);
  });
});

// ── Map Validation ────────────────────────────────────────────────────────

describe('isRPGMakerMap', () => {
  it('returns true for valid map object', () => {
    expect(isRPGMakerMap({ width: 10, height: 10, data: [], events: [] })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isRPGMakerMap(null)).toBe(false);
  });

  it('returns false for missing fields', () => {
    expect(isRPGMakerMap({ width: 10 })).toBe(false);
    expect(isRPGMakerMap({ width: 10, height: 10 })).toBe(false);
    expect(isRPGMakerMap({ width: 10, height: 10, data: [] })).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isRPGMakerMap('string')).toBe(false);
    expect(isRPGMakerMap(42)).toBe(false);
  });
});

// ── Event Parsing ─────────────────────────────────────────────────────────

describe('parseEvents', () => {
  it('returns empty for no events', () => {
    expect(parseEvents([null])).toEqual([]);
  });

  it('parses room: events', () => {
    const events: (RPGMakerEvent | null)[] = [
      null,
      { id: 1, name: 'room:isaac', x: 5, y: 8 },
    ];
    const markers = parseEvents(events);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toEqual({ type: 'room', roomId: 'isaac', col: 5, row: 8 });
  });

  it('parses door: events', () => {
    const events: (RPGMakerEvent | null)[] = [
      null,
      { id: 1, name: 'door:billy', x: 10, y: 3 },
    ];
    const markers = parseEvents(events);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toEqual({ type: 'door', roomId: 'billy', col: 10, row: 3 });
  });

  it('parses billy-stand: events', () => {
    const events: (RPGMakerEvent | null)[] = [
      null,
      { id: 1, name: 'billy-stand:marcos', x: 4, y: 22 },
    ];
    const markers = parseEvents(events);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toEqual({ type: 'billy-stand', roomId: 'marcos', col: 4, row: 22 });
  });

  it('ignores events with unknown room IDs', () => {
    const events: (RPGMakerEvent | null)[] = [
      null,
      { id: 1, name: 'room:unknown-agent', x: 5, y: 8 },
    ];
    expect(parseEvents(events)).toHaveLength(0);
  });

  it('handles mixed event types', () => {
    const events: (RPGMakerEvent | null)[] = [
      null,
      { id: 1, name: 'room:isaac', x: 5, y: 8 },
      { id: 2, name: 'door:isaac', x: 5, y: 10 },
      { id: 3, name: 'file-table:isaac', x: 8, y: 7 },
    ];
    const markers = parseEvents(events);
    expect(markers).toHaveLength(3);
    expect(markers.map(m => m.type)).toEqual(['room', 'door', 'file-table']);
  });
});

// ── Full Map Conversion ───────────────────────────────────────────────────

describe('convertRPGMakerMap', () => {
  it('converts an empty map to all VOID tiles', () => {
    const map = makeMap(5, 5);
    const result = convertRPGMakerMap(map);

    expect(result.version).toBe(1);
    expect(result.gridCols).toBe(5);
    expect(result.gridRows).toBe(5);
    expect(result.tileMap).toHaveLength(5);
    expect(result.tileMap[0]).toHaveLength(5);
    // All tiles should be VOID (0) since all data is 0
    for (const row of result.tileMap) {
      for (const tile of row) {
        expect(tile).toBe(0);
      }
    }
  });

  it('classifies A2 ground tiles as FLOOR', () => {
    const map = makeMap(3, 3);
    // Set all ground layer tiles to A2 range (floor)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        setTile(map, x, y, 0, 2816); // A2 start = floor
      }
    }

    const result = convertRPGMakerMap(map);
    for (const row of result.tileMap) {
      for (const tile of row) {
        expect(tile).toBe(1); // FLOOR
      }
    }
  });

  it('classifies A3 wall tiles as WALL', () => {
    const map = makeMap(3, 3);
    setTile(map, 1, 1, 0, 4500); // A3 range = wall

    const result = convertRPGMakerMap(map);
    expect(result.tileMap[1]![1]).toBe(2); // WALL
  });

  it('upper layer WALL tiles override ground FLOOR', () => {
    const map = makeMap(3, 3);
    setTile(map, 1, 1, 0, 2816); // Ground = floor
    setTile(map, 1, 1, 1, 4500); // Layer 1 = wall override

    const result = convertRPGMakerMap(map);
    expect(result.tileMap[1]![1]).toBe(2); // WALL overrides FLOOR
  });

  it('creates DOOR tiles from door events', () => {
    const map = makeMap(5, 5);
    // Set floor everywhere
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        setTile(map, x, y, 0, 2816);
      }
    }
    map.events = [
      null,
      { id: 1, name: 'door:isaac', x: 2, y: 4 },
    ];

    const result = convertRPGMakerMap(map);
    expect(result.tileMap[4]![2]).toBe(3); // DOOR
  });

  it('detects rooms from region data', () => {
    const map = makeMap(10, 10);
    // Paint region 1 (Isaac) over a 5×5 area
    for (let y = 2; y < 7; y++) {
      for (let x = 1; x < 6; x++) {
        setRegion(map, x, y, 1); // Region 1 = isaac
      }
    }

    const result = convertRPGMakerMap(map);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0]!.id).toBe('isaac');
    expect(result.rooms[0]!.col).toBe(1);
    expect(result.rooms[0]!.row).toBe(2);
    expect(result.rooms[0]!.width).toBe(5);
    expect(result.rooms[0]!.height).toBe(5);
  });

  it('uses event markers for seat/door positions', () => {
    const map = makeMap(10, 10);
    // Paint region 2 (Billy)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 8; x++) {
        setRegion(map, x, y, 2);
      }
    }
    map.events = [
      null,
      { id: 1, name: 'room:billy', x: 4, y: 3 },
      { id: 2, name: 'door:billy', x: 4, y: 4 },
    ];

    const result = convertRPGMakerMap(map);
    expect(result.rooms).toHaveLength(1);
    const billy = result.rooms[0]!;
    expect(billy.id).toBe('billy');
    expect(billy.seatCol).toBe(4);
    expect(billy.seatRow).toBe(3);
    expect(billy.doorCol).toBe(4);
    expect(billy.doorRow).toBe(4);
  });

  it('output matches LayoutData schema', () => {
    const map = makeMap(5, 5);
    const result = convertRPGMakerMap(map);

    // Required LayoutData fields
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('gridCols');
    expect(result).toHaveProperty('gridRows');
    expect(result).toHaveProperty('tileMap');
    expect(result).toHaveProperty('furniture');
    expect(result).toHaveProperty('decorations');
    expect(result).toHaveProperty('rooms');
    expect(result).toHaveProperty('rugs');

    // Type checks
    expect(typeof result.version).toBe('number');
    expect(typeof result.gridCols).toBe('number');
    expect(typeof result.gridRows).toBe('number');
    expect(Array.isArray(result.tileMap)).toBe(true);
    expect(Array.isArray(result.furniture)).toBe(true);
    expect(Array.isArray(result.decorations)).toBe(true);
    expect(Array.isArray(result.rooms)).toBe(true);
    expect(Array.isArray(result.rugs)).toBe(true);
  });

  it('handles multiple rooms with different regions', () => {
    const map = makeMap(20, 10);
    // Region 1 (Isaac) left side
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 8; x++) {
        setRegion(map, x, y, 1);
      }
    }
    // Region 3 (Patrik) right side
    for (let y = 0; y < 5; y++) {
      for (let x = 12; x < 20; x++) {
        setRegion(map, x, y, 3);
      }
    }

    const result = convertRPGMakerMap(map);
    expect(result.rooms).toHaveLength(2);

    const ids = result.rooms.map(r => r.id).sort();
    expect(ids).toEqual(['isaac', 'patrik']);
  });
});
