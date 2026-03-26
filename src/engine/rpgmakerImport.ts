// RPG Maker MZ → Lemon AIVO map converter.
//
// Reads an RPG Maker MZ MapXXX.json file and produces a LayoutData object
// compatible with layoutSerializer.ts. Both systems use 48×48 tiles natively,
// so coordinates map 1:1 with no scaling required.
//
// RPG Maker MZ Map JSON Format:
//   { width, height, tilesetId, data: number[], events: (Event|null)[] }
//
// The `data` array is flat with 6 "z-layers" stored sequentially:
//   index = z * (width * height) + y * width + x
//
//   z=0: Ground (A tiles — floors and walls)
//   z=1: Buildings/decorations below characters (B-E tiles or A-tile overlays)
//   z=2: Objects above ground (B-E tiles — furniture)
//   z=3: Upper objects (B-E tiles — wall decorations, overhangs)
//   z=4: Shadow data (bit flags)
//   z=5: Region data (1-255 user-assigned region IDs)
//
// Tile ID Ranges:
//   0        = empty (transparent)
//   1-2047   = autotile set (A1-A4), encoded with shape + animation bits
//   2048+    = normal tile (B=2048, C=4096, D=6144, E=8192), simple index
//
// Room Assignment via region IDs:
//   Region 1 = isaac,  2 = billy,   3 = patrik
//   Region 4 = marcos, 5 = war-room, 6 = sandra
//   Region 7 = charlie, 8 = wendy
//
// Events named `room:AGENT_ID` mark the agent's seat position.
// Events named `door:AGENT_ID` mark the room's door tile.

import type { LayoutData } from './layoutSerializer';

// ── RPG Maker MZ JSON Types ────────────────────────────────────────────────

export interface RPGMakerEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  pages?: unknown[];
}

export interface RPGMakerMap {
  /** Map width in tiles */
  width: number;
  /** Map height in tiles */
  height: number;
  /** Tileset index (references Tilesets.json) */
  tilesetId: number;
  /** Flat tile data array: 6 layers × (width × height) */
  data: number[];
  /** Events array (index 0 is always null) */
  events: (RPGMakerEvent | null)[];
  /** Display name (optional) */
  displayName?: string;
}

// ── Tile ID Classification ─────────────────────────────────────────────────
//
// Autotile ID ranges (used inline in classifyTileId):
//   A1 (water):     2048-2815
//   A2 (ground):    2816-4351
//   A3 (walls):     4352-5887
//   A4 (wall-tops): 5888-8191
//   A5 (normal-A):  1536-2047
//   B-E (normal):   ≥ 8192

/**
 * Classify a raw RPG Maker tile ID into a Lemon AIVO TileType value.
 *
 * RPG Maker MZ tile ID encoding (from rpg_core.js Tilemap):
 *   - 0 = empty (no tile)
 *   - Autotiles (A sets): IDs are encoded with base + shape index
 *     - A1 (water):     base IDs 2048-2815 (animated, ocean/deep water)
 *     - A2 (ground):    base IDs 2816-4351 (grass, dirt, floors)
 *     - A3 (walls):     base IDs 4352-5887 (building walls, auto-shaped)
 *     - A4 (wall-tops): base IDs 5888-8191 (upper wall segments)
 *   - Normal tiles: ID ≥ 1536 in the B-E range, but the actual start depends
 *     on how RPG Maker encodes them. B = first normal tileset.
 *
 * Simplified classification used here:
 *   - 0 → VOID (empty)
 *   - A1 range → VOID (water — not used in offices)
 *   - A2 range → FLOOR (ground tiles)
 *   - A3/A4 range → WALL (wall autotiles)
 *   - B-E range (≥ 2048 but we check after autotile ranges) → FLOOR (furniture sits on floor)
 */
export function classifyTileId(tileId: number): number {
  if (tileId === 0) return 0; // VOID

  // Autotile ranges (A sets use IDs in specific ranges)
  // RPG Maker encodes autotile IDs as: baseId + shapeIndex
  // A1: ocean/water (2048-2815) → VOID
  if (tileId >= 2048 && tileId < 2816) return 0; // VOID (water)

  // A2: ground/floor (2816-4351) → FLOOR
  if (tileId >= 2816 && tileId < 4352) return 1; // FLOOR

  // A3: walls (4352-5887) → WALL
  if (tileId >= 4352 && tileId < 5888) return 2; // WALL

  // A4: wall tops (5888-8191) → WALL
  if (tileId >= 5888 && tileId < 8192) return 2; // WALL

  // A5: normal A tiles (1536-2047 range, simple ground)
  // These are non-autotile A-sheet tiles
  if (tileId >= 1536 && tileId < 2048) return 1; // FLOOR

  // Low IDs (1-1535) are other autotile encodings → FLOOR as default
  if (tileId >= 1 && tileId < 1536) return 1; // FLOOR

  // B-E sheets (≥ 8192 in some encodings, or within a different range)
  // Normal tiles that aren't autotiles → treated as FLOOR (furniture overlaid)
  return 1; // FLOOR
}

/**
 * Check if a tile ID is from the B, C, D, or E tileset sheets.
 * These are "normal" tiles (not autotiles) used for furniture/objects.
 */
export function isNormalTile(tileId: number): boolean {
  // B-E tiles in RPG Maker MZ are in the range 2048+ but after all A-set autotiles.
  // More precisely, B = first 256 normal tiles, C = next 256, etc.
  // They share the same ID space but are distinguished from A-set autotiles
  // by being ≥ 8192 in RPG Maker MZ's encoding.
  return tileId >= 8192;
}

// ── Region → Room Mapping ──────────────────────────────────────────────────

/** Maps RPG Maker region IDs to Lemon AIVO room IDs. */
const REGION_TO_ROOM: Record<number, string> = {
  1: 'isaac',
  2: 'billy',
  3: 'patrik',
  4: 'marcos',
  5: 'war-room',
  6: 'sandra',
  7: 'charlie',
  8: 'wendy',
};

/** All recognized room IDs. */
const ALL_ROOM_IDS = new Set(Object.values(REGION_TO_ROOM));

/** Default room names. */
const ROOM_NAMES: Record<string, string> = {
  'isaac':    "Isaac's Office",
  'billy':    "BILLY's Office",
  'patrik':   "Patrik's Office",
  'marcos':   "Marcos's Office",
  'war-room': 'Board Room',
  'sandra':   "Sandra's Office",
  'charlie':  "Charlie's Office",
  'wendy':    "Wendy's Coaching Room",
};

// ── Event Parsing ──────────────────────────────────────────────────────────

interface ParsedMarker {
  type: 'room' | 'door' | 'furniture' | 'billy-stand' | 'file-table';
  roomId: string;
  col: number;
  row: number;
}

/**
 * Parse RPG Maker events into typed markers.
 *
 * Event naming convention:
 *   - `room:isaac`       → seat tile for Isaac
 *   - `door:isaac`       → door tile for Isaac's room
 *   - `billy-stand:isaac` → Billy's visitor stand tile in Isaac's room
 *   - `file-table:isaac` → file table tile in Isaac's room
 *   - `furniture:desk`   → a furniture placement (atlas key = 'desk')
 */
export function parseEvents(events: (RPGMakerEvent | null)[]): ParsedMarker[] {
  const markers: ParsedMarker[] = [];

  for (const ev of events) {
    if (!ev || !ev.name) continue;

    const name = ev.name.trim().toLowerCase();

    if (name.startsWith('room:')) {
      const roomId = name.slice(5).trim();
      if (ALL_ROOM_IDS.has(roomId)) {
        markers.push({ type: 'room', roomId, col: ev.x, row: ev.y });
      }
    } else if (name.startsWith('door:')) {
      const roomId = name.slice(5).trim();
      if (ALL_ROOM_IDS.has(roomId)) {
        markers.push({ type: 'door', roomId, col: ev.x, row: ev.y });
      }
    } else if (name.startsWith('billy-stand:')) {
      const roomId = name.slice(12).trim();
      if (ALL_ROOM_IDS.has(roomId)) {
        markers.push({ type: 'billy-stand', roomId, col: ev.x, row: ev.y });
      }
    } else if (name.startsWith('file-table:')) {
      const roomId = name.slice(11).trim();
      if (ALL_ROOM_IDS.has(roomId)) {
        markers.push({ type: 'file-table', roomId, col: ev.x, row: ev.y });
      }
    }
  }

  return markers;
}

// ── Room Bounds Detection ──────────────────────────────────────────────────

interface RoomBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/**
 * Detect room bounding rectangles from region data.
 * Scans the region layer (z=5) for contiguous regions and computes bounds.
 */
function detectRoomBounds(
  width: number,
  height: number,
  data: number[],
): Record<string, RoomBounds> {
  const layerOffset = 5 * width * height; // z=5 = region layer
  const bounds: Record<string, RoomBounds> = {};

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const regionId = data[layerOffset + y * width + x] ?? 0;
      const roomId = REGION_TO_ROOM[regionId];
      if (!roomId) continue;

      if (!bounds[roomId]) {
        bounds[roomId] = { minCol: x, maxCol: x, minRow: y, maxRow: y };
      } else {
        const b = bounds[roomId]!;
        b.minCol = Math.min(b.minCol, x);
        b.maxCol = Math.max(b.maxCol, x);
        b.minRow = Math.min(b.minRow, y);
        b.maxRow = Math.max(b.maxRow, y);
      }
    }
  }

  return bounds;
}

// ── Main Converter ─────────────────────────────────────────────────────────

/**
 * Convert an RPG Maker MZ map JSON into a Lemon AIVO LayoutData object.
 *
 * 1. Reads the ground layer (z=0) and classifies tiles into FLOOR/WALL/VOID
 * 2. Reads layer 2-3 for object tiles and marks furniture positions
 * 3. Reads region layer (z=5) to assign tiles to rooms
 * 4. Parses events for room markers (seat, door, billy-stand, file-table)
 * 5. Overrides DOOR tiles from event markers
 * 6. Builds Room[] and FurnitureItem[] arrays
 * 7. Returns a complete LayoutData for deserialization
 */
export function convertRPGMakerMap(map: RPGMakerMap): LayoutData {
  const { width, height, data, events } = map;
  const layerSize = width * height;

  // ── Step 1: Build tile map from ground layer (z=0) ─────────────────────
  const tileMap: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const tileId = data[0 * layerSize + y * width + x] ?? 0;
      row.push(classifyTileId(tileId));
    }
    tileMap.push(row);
  }

  // ── Step 2: Overlay layers 1-3 (wall/door overrides from upper layers) ──
  for (let z = 1; z <= 3; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileId = data[z * layerSize + y * width + x] ?? 0;
        if (tileId === 0) continue;

        const classified = classifyTileId(tileId);
        // If upper layer has a WALL tile, override floor to wall
        if (classified === 2) {
          tileMap[y]![x] = 2; // WALL
        }
      }
    }
  }

  // ── Step 3: Parse events for room/door markers ─────────────────────────
  const markers = parseEvents(events);

  // Apply DOOR tiles from markers
  for (const m of markers) {
    if (m.type === 'door' && m.row >= 0 && m.row < height && m.col >= 0 && m.col < width) {
      tileMap[m.row]![m.col] = 3; // DOOR
    }
  }

  // ── Step 4: Detect room bounds from region data ────────────────────────
  const roomBounds = detectRoomBounds(width, height, data);

  // ── Step 5: Build room definitions ─────────────────────────────────────
  const seatMarkers = new Map<string, { col: number; row: number }>();
  const doorMarkers = new Map<string, { col: number; row: number }>();
  const billyStandMarkers = new Map<string, { col: number; row: number }>();
  const fileTableMarkers = new Map<string, { col: number; row: number }>();

  for (const m of markers) {
    if (m.type === 'room') seatMarkers.set(m.roomId, { col: m.col, row: m.row });
    if (m.type === 'door') doorMarkers.set(m.roomId, { col: m.col, row: m.row });
    if (m.type === 'billy-stand') billyStandMarkers.set(m.roomId, { col: m.col, row: m.row });
    if (m.type === 'file-table') fileTableMarkers.set(m.roomId, { col: m.col, row: m.row });
  }

  interface SerializedRoom {
    id: string;
    name: string;
    col: number;
    row: number;
    width: number;
    height: number;
    doorCol: number;
    doorRow: number;
    seatCol: number;
    seatRow: number;
    billyStandCol: number;
    billyStandRow: number;
  }

  const rooms: SerializedRoom[] = [];

  for (const [roomId, b] of Object.entries(roomBounds)) {
    const roomWidth = b.maxCol - b.minCol + 1;
    const roomHeight = b.maxRow - b.minRow + 1;
    const centerCol = Math.floor(b.minCol + roomWidth / 2);
    const centerRow = Math.floor(b.minRow + roomHeight / 2);

    // Use event markers if available, otherwise default to center of room
    const seat = seatMarkers.get(roomId) ?? { col: centerCol, row: centerRow };
    const door = doorMarkers.get(roomId) ?? { col: centerCol, row: b.maxRow };
    const billyStand = billyStandMarkers.get(roomId) ?? { col: seat.col + 1, row: seat.row };
    const _fileTable = fileTableMarkers.get(roomId) ?? { col: seat.col + 2, row: seat.row };

    rooms.push({
      id: roomId,
      name: ROOM_NAMES[roomId] ?? roomId,
      col: b.minCol,
      row: b.minRow,
      width: roomWidth,
      height: roomHeight,
      doorCol: door.col,
      doorRow: door.row,
      seatCol: seat.col,
      seatRow: seat.row,
      billyStandCol: billyStand.col,
      billyStandRow: billyStand.row,
    });
  }

  // ── Step 6: Extract furniture from B-E tile layers ─────────────────────
  // For now, skip automatic furniture extraction — the user places furniture
  // via the Furniture Composer or editor mode. This can be enhanced later.
  const furniture: LayoutData['furniture'] = [];
  const decorations: LayoutData['decorations'] = [];
  const rugs: LayoutData['rugs'] = [];

  // ── Step 7: Assemble LayoutData ────────────────────────────────────────
  return {
    version: 1,
    gridCols: width,
    gridRows: height,
    tileMap,
    furniture,
    decorations,
    rooms,
    rugs,
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate that a parsed JSON object looks like an RPG Maker MZ map.
 * Returns true if it has the required fields.
 */
export function isRPGMakerMap(obj: unknown): obj is RPGMakerMap {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    Array.isArray(o.data) &&
    Array.isArray(o.events)
  );
}

// ── Reverse mapping: Room → Region ─────────────────────────────────────────

const ROOM_TO_REGION: Record<string, number> = Object.fromEntries(
  Object.entries(REGION_TO_ROOM).map(([k, v]) => [v, Number(k)])
);

// ── TileType → RPG Maker tile ID ───────────────────────────────────────────
//
// We use representative tile IDs from each autotile set so that RPG Maker
// renders recognizable tiles when the map is opened in the editor:
//   VOID (0) → 0 (empty)
//   FLOOR (1) → 2816 (A2 ground, first tile — generic brown floor)
//   WALL (2) → 4352 (A3 wall, first tile — generic wall)
//   DOOR (3) → 2816 (same as floor — doors are walkable floor gaps)

const TILETYPE_TO_RPGID: Record<number, number> = {
  0: 0,     // VOID → empty
  1: 2816,  // FLOOR → A2 ground
  2: 4352,  // WALL → A3 wall
  3: 2816,  // DOOR → A2 ground (walkable)
};

// ── Export: Lemon AIVO → RPG Maker MZ Map JSON ────────────────────────────

/**
 * Export the current Lemon AIVO office layout as an RPG Maker MZ MapXXX.json.
 *
 * You can open this JSON in RPG Maker MZ to visually edit the office layout,
 * then re-import the modified map back into the app using the converter.
 *
 * The export includes ALL required RPG Maker MZ fields so the map can be
 * playtested without errors.
 */
export function exportToRPGMakerMap(
  tileMap: number[][],
  rooms: Array<{
    id: string;
    tileRect: { col: number; row: number; width: number; height: number };
    doorTile: { col: number; row: number };
    seatTile: { col: number; row: number };
    billyStandTile: { col: number; row: number };
    fileTableTile: { col: number; row: number };
  }>,
): Record<string, unknown> {
  const height = tileMap.length;
  const width = height > 0 ? tileMap[0]!.length : 0;
  const layerSize = width * height;

  // 6 layers, all initialized to 0
  const data = new Array(layerSize * 6).fill(0);

  // ── Layer 0: Ground tiles ──────────────────────────────────────────────
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileType = tileMap[y]![x] ?? 0;
      data[0 * layerSize + y * width + x] = TILETYPE_TO_RPGID[tileType] ?? 0;
    }
  }

  // ── Layer 5: Region data (room assignments) ────────────────────────────
  for (const room of rooms) {
    const regionId = ROOM_TO_REGION[room.id];
    if (regionId === undefined) continue;

    const r = room.tileRect;
    for (let y = r.row; y < r.row + r.height; y++) {
      for (let x = r.col; x < r.col + r.width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          data[5 * layerSize + y * width + x] = regionId;
        }
      }
    }
  }

  // ── Events: room markers (with full RPG Maker event structure) ─────────
  // RPG Maker MZ requires events to have a `pages` array with at least one
  // page, otherwise the engine crashes with "Cannot read property 'length'"
  const events: (Record<string, unknown> | null)[] = [null]; // index 0 is always null
  let eventId = 1;

  const makeEvent = (id: number, name: string, x: number, y: number): Record<string, unknown> => ({
    id,
    name,
    note: '',
    pages: [{
      conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false,
                    selfSwitchCh: 'A', selfSwitchValid: false, switch1Id: 1,
                    switch1Valid: false, switch2Id: 1, switch2Valid: false,
                    variableId: 1, variableValid: false, variableValue: 0 },
      directionFix: false,
      image: { characterIndex: 0, characterName: '', direction: 2, pattern: 0, tileId: 0 },
      list: [{ code: 0, indent: 0, parameters: [] }],
      moveFrequency: 3,
      moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
      moveSpeed: 3,
      moveType: 0,
      priorityType: 0,
      stepAnime: false,
      through: true,
      trigger: 0,
      walkAnime: true,
    }],
    x,
    y,
  });

  for (const room of rooms) {
    events.push(makeEvent(eventId++, `room:${room.id}`, room.seatTile.col, room.seatTile.row));
    events.push(makeEvent(eventId++, `door:${room.id}`, room.doorTile.col, room.doorTile.row));
    events.push(makeEvent(eventId++, `billy-stand:${room.id}`, room.billyStandTile.col, room.billyStandTile.row));
    events.push(makeEvent(eventId++, `file-table:${room.id}`, room.fileTableTile.col, room.fileTableTile.row));
  }

  // ── Complete RPG Maker MZ MapXXX.json ──────────────────────────────────
  // All fields required by rpg_managers.js DataManager.loadMapData()
  return {
    autoplayBgm: false,
    autoplayBgs: false,
    battleback1Name: '',
    battleback2Name: '',
    bgm: { name: '', pan: 0, pitch: 100, volume: 90 },
    bgs: { name: '', pan: 0, pitch: 100, volume: 90 },
    disableDashing: false,
    displayName: 'Lemon AIVO Office',
    encounterList: [],
    encounterStep: 30,
    height,
    note: '',
    parallaxLoopX: false,
    parallaxLoopY: false,
    parallaxName: '',
    parallaxShow: true,
    parallaxSx: 0,
    parallaxSy: 0,
    scrollType: 0,
    specifyBattleback: false,
    tilesetId: 1,
    width,
    data,
    events,
  };
}

