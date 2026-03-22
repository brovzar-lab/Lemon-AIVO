// ═══════════════════════════════════════════════════════════════════════════════
// Tile map derived from pixelScene visual layout.
//
// The pixelScene (1280×912) is scaled by (720/1280, 608/912) = (0.5625, 0.6667)
// to fit the world space (45 cols × 38 rows × 16px = 720 × 608).
//
// Conversion: pixelScene (px_x, px_y) → tile (col, row):
//   col = floor(px_x * 0.5625 / 16) = floor(px_x / 28.444)
//   row = floor(px_y * 0.66667 / 16) = floor(px_y / 24.0)
//
// Room layout (matching pixelScene):
//   [Isaac 11×9]   [Billy 19×9]   [Patrik 11×9]      ← rows 2-10
//             [ hallway rows 11-12 ]
//   [Marcos 11×12] [BOARD 19×12]  [Sandra 11×12]     ← rows 14-25
//             [ hallway rows 26-27 ]
//   [Charlie 11×10] [ open floor ] [Wendy 11×10]     ← rows 28-37
//
// Vertical hallways: cols 11-12 (left), cols 32-33 (right), rows 11-27
// ═══════════════════════════════════════════════════════════════════════════════

import { TileType } from './types';
import type { Room, TileCoord } from './types';
import { rebuildCollisionOverlay } from './tileMap';

const F = TileType.FLOOR;
const W = TileType.WALL;
const D = TileType.DOOR;

const GRID_COLS = 45;
const GRID_ROWS = 38;

/* eslint-disable @typescript-eslint/no-non-null-assertion */
function buildTileMap(): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < GRID_COLS; c++) row.push(F);
    map.push(row);
  }

  const fill = (startCol: number, startRow: number, w: number, h: number, tile: TileType): void => {
    for (let r = startRow; r < startRow + h; r++)
      for (let c = startCol; c < startCol + w; c++)
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS)
          map[r]![c] = tile;
  };

  const room = (col: number, row: number, w: number, h: number): void => {
    fill(col, row, w, h, W);
    fill(col + 1, row + 1, w - 2, h - 2, F);
  };

  // ── ROOMS — aligned to pixelScene visual positions ────────────────────────
  // TOP ROW (rows 2-10)
  room(0, 2, 11, 9);    // Isaac:   cols  0-10,  rows 2-10
  room(13, 2, 19, 9);   // Billy:   cols 13-31,  rows 2-10
  room(34, 2, 11, 9);   // Patrik:  cols 34-44,  rows 2-10

  // MID (rows 14-25)
  room(0, 14, 11, 12);  // Marcos:  cols  0-10,  rows 14-25
  room(13, 14, 19, 12); // Board:   cols 13-31,  rows 14-25
  room(34, 14, 11, 12); // Sandra:  cols 34-44,  rows 14-25

  // BOT ROW (rows 28-37)
  room(0, 28, 11, 10);  // Charlie: cols  0-10,  rows 28-37
  room(34, 28, 11, 10); // Wendy:   cols 34-44,  rows 28-37

  // ── DOORS — positioned to match pixelScene door locations ───────────────
  // Top row: bottom walls (row 10)
  map[10]![5] = D;                      // Isaac bottom door, center col
  map[10]![22] = D; map[10]![23] = D;   // Billy bottom door, cols 22-23
  map[10]![39] = D;                      // Patrik bottom door

  // Mid row: side walls
  map[18]![10] = D; map[19]![10] = D;   // Marcos right wall door (col 10, rows 18-19)
  map[18]![13] = D; map[19]![13] = D;   // Board left wall door (col 13, rows 18-19)
  map[18]![34] = D; map[19]![34] = D;   // Sandra left wall door (col 34, rows 18-19)

  // Bot row: side walls
  map[33]![10] = D; map[34]![10] = D;   // Charlie right wall door (col 10, rows 33-34)
  map[33]![34] = D; map[34]![34] = D;   // Wendy left wall door (col 34, rows 33-34)

  return map;
}

export const OFFICE_TILE_MAP: TileType[][] = buildTileMap();

// -- Room Definitions ---------------------------------------------------------

export const ROOMS: Room[] = [
  {
    id: 'isaac',
    name: "Isaac's Office",
    tileRect: { col: 0, row: 2, width: 11, height: 9 },
    doorTile: { col: 5, row: 10 },
    seatTile: { col: 3, row: 8 },
    billyStandTile: { col: 4, row: 8 },
  },
  {
    id: 'billy',
    name: "BILLY's Office",
    tileRect: { col: 13, row: 2, width: 19, height: 9 },
    doorTile: { col: 22, row: 10 },
    seatTile: { col: 22, row: 8 },
    billyStandTile: { col: 23, row: 8 },
  },
  {
    id: 'patrik',
    name: "Patrik's Office",
    tileRect: { col: 34, row: 2, width: 11, height: 9 },
    doorTile: { col: 39, row: 10 },
    seatTile: { col: 39, row: 8 },
    billyStandTile: { col: 38, row: 8 },
  },
  {
    id: 'marcos',
    name: "Marcos's Office",
    tileRect: { col: 0, row: 14, width: 11, height: 12 },
    doorTile: { col: 10, row: 18 },
    seatTile: { col: 3, row: 22 },
    billyStandTile: { col: 4, row: 22 },
  },
  {
    id: 'war-room',
    name: 'Board Room',
    tileRect: { col: 13, row: 14, width: 19, height: 12 },
    doorTile: { col: 13, row: 18 },
    seatTile: { col: 22, row: 20 },
    billyStandTile: { col: 22, row: 17 },
  },
  {
    id: 'sandra',
    name: "Sandra's Office",
    tileRect: { col: 34, row: 14, width: 11, height: 12 },
    doorTile: { col: 34, row: 18 },
    seatTile: { col: 39, row: 22 },
    billyStandTile: { col: 38, row: 22 },
  },
  {
    id: 'charlie',
    name: "Charlie's Office",
    tileRect: { col: 0, row: 28, width: 11, height: 10 },
    doorTile: { col: 10, row: 33 },
    seatTile: { col: 3, row: 36 },
    billyStandTile: { col: 4, row: 36 },
  },
  {
    id: 'wendy',
    name: "Wendy's Coaching Room",
    tileRect: { col: 34, row: 28, width: 11, height: 10 },
    doorTile: { col: 34, row: 33 },
    seatTile: { col: 39, row: 33 },
    billyStandTile: { col: 38, row: 33 },
  },
];

// -- Furniture ----------------------------------------------------------------

export interface FurnitureItem {
  roomId: string;
  type: 'desk' | 'chair' | 'table' | 'bookshelf' | 'plant' | 'water-cooler' | 'artwork' | 'couch' | 'monitor' | 'whiteboard' | 'filing-cabinet';
  col: number;
  row: number;
  width: number;
  height: number;
  atlasKey?: string;
  /** Clockwise rotation in degrees applied at draw time. Default: 0 (no rotation). */
  rotation?: 0 | 90 | 180 | 270;
  /**
   * Override the depth-sort row used by buildRenderables.
   * When set, sort key = row + spriteRows - 1 instead of row + height - 1.
   * Use when the sprite is shorter than the collision footprint (e.g. conference
   * table: sprite 3 rows tall but collision 7 rows to prevent sprite overlap).
   */
  spriteRows?: number;
}

/** Hardcoded default furniture items. Merged back after IDB restore so they
 *  always appear even if the saved layout didn't contain them. */
export const DEFAULT_FURNITURE: FurnitureItem[] = [
  // ════════════════════════════════════════════════════════════════════════════
  // Default office furniture — desk, chair, bookshelf, plant per room.
  // Users can modify these via Edit Mode (✏️ button).
  // ════════════════════════════════════════════════════════════════════════════

  // ── Isaac's Office (interior cols 3-13, rows 3-10) ─────────────────────────
  { roomId: 'isaac',   type: 'desk',      col: 5,  row: 3,  width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'isaac',   type: 'chair',     col: 8,  row: 5,  width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'isaac',   type: 'bookshelf', col: 3,  row: 3,  width: 2, height: 3, atlasKey: 'bookshelf-2tall' },
  { roomId: 'isaac',   type: 'plant',     col: 12, row: 3,  width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: 'isaac',   type: 'filing-cabinet', col: 10, row: 3, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Billy's Office (interior cols 17-29, rows 3-10) ────────────────────────
  { roomId: 'billy',   type: 'desk',      col: 21, row: 3,  width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'billy',   type: 'chair',     col: 22, row: 5,  width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'billy',   type: 'bookshelf', col: 17, row: 3,  width: 2, height: 3, atlasKey: 'bookshelf-2tall' },
  { roomId: 'billy',   type: 'plant',     col: 28, row: 3,  width: 2, height: 2, atlasKey: 'plant-large-g' },
  { roomId: 'billy',   type: 'monitor',   col: 24, row: 3,  width: 4, height: 2, atlasKey: 'monitor' },

  // ── Patrik's Office (interior cols 33-41, rows 3-10) ───────────────────────
  { roomId: 'patrik',  type: 'desk',      col: 35, row: 3,  width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'patrik',  type: 'chair',     col: 37, row: 5,  width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'patrik',  type: 'bookshelf', col: 33, row: 3,  width: 2, height: 3, atlasKey: 'bookshelf-2tall' },
  { roomId: 'patrik',  type: 'plant',     col: 41, row: 3,  width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: 'patrik',  type: 'filing-cabinet', col: 40, row: 3, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Marcos's Office (interior cols 3-12, rows 15-22) ───────────────────────
  { roomId: 'marcos',  type: 'desk',      col: 5,  row: 15, width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'marcos',  type: 'chair',     col: 7,  row: 17, width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'marcos',  type: 'bookshelf', col: 3,  row: 15, width: 2, height: 3, atlasKey: 'bookshelf-2tall' },
  { roomId: 'marcos',  type: 'plant',     col: 11, row: 15, width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: 'marcos',  type: 'filing-cabinet', col: 10, row: 15, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Sandra's Office (interior cols 33-41, rows 15-22) ──────────────────────
  { roomId: 'sandra',  type: 'desk',      col: 35, row: 15, width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'sandra',  type: 'chair',     col: 37, row: 17, width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'sandra',  type: 'bookshelf', col: 33, row: 15, width: 2, height: 3, atlasKey: 'bookshelf-2tall' },
  { roomId: 'sandra',  type: 'plant',     col: 41, row: 15, width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: 'sandra',  type: 'filing-cabinet', col: 40, row: 15, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Charlie's Office (interior cols 3-12, rows 27-34) ──────────────────────
  { roomId: 'charlie', type: 'desk',      col: 5,  row: 27, width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'charlie', type: 'chair',     col: 7,  row: 29, width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'charlie', type: 'bookshelf', col: 3,  row: 27, width: 2, height: 3, atlasKey: 'bookshelf-2tall' },
  { roomId: 'charlie', type: 'plant',     col: 11, row: 27, width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: 'charlie', type: 'filing-cabinet', col: 10, row: 27, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Wendy's Office (interior cols 33-41, rows 27-34) ───────────────────────
  { roomId: 'wendy',   type: 'desk',      col: 35, row: 27, width: 2, height: 3, atlasKey: 'desk-wood-2wide' },
  { roomId: 'wendy',   type: 'chair',     col: 37, row: 29, width: 2, height: 2, atlasKey: 'chair-office' },
  { roomId: 'wendy',   type: 'plant',     col: 33, row: 27, width: 2, height: 2, atlasKey: 'plant-large-g' },
  { roomId: 'wendy',   type: 'couch',     col: 40, row: 27, width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: 'wendy',   type: 'filing-cabinet', col: 40, row: 30, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Board Room (conference table is placed separately) ─────────────────────
  { roomId: 'war-room', type: 'table',    col: 20, row: 18, width: 5, height: 3, atlasKey: 'conf-table', spriteRows: 3 },
  { roomId: 'war-room', type: 'whiteboard', col: 17, row: 15, width: 3, height: 2, atlasKey: 'whiteboard' },

  // ── HALLWAY PLANTS — corridor junctions ────────────────────────────────────
  { roomId: '',        type: 'plant',     col: 14, row: 12, width: 2, height: 2, atlasKey: 'plant-large-g' },
  { roomId: '',        type: 'plant',     col: 30, row: 12, width: 2, height: 2, atlasKey: 'plant-large-g' },
  { roomId: '',        type: 'plant',     col: 14, row: 23, width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: '',        type: 'plant',     col: 30, row: 23, width: 1, height: 2, atlasKey: 'plant-potted' },
  { roomId: '',        type: 'plant',     col: 14, row: 35, width: 2, height: 2, atlasKey: 'plant-large-g' },
  { roomId: '',        type: 'plant',     col: 30, row: 35, width: 2, height: 2, atlasKey: 'plant-large-g' },
];

export const FURNITURE: FurnitureItem[] = [...DEFAULT_FURNITURE];


// -- War Room Seats -----------------------------------------------------------

/**
 * Board Room table: cols 17-27, rows 18-22 (pixelScene drawBoardTable).
 * Seats placed AROUND the table, not on it.
 * Billy at head (top center). Wendy does not attend board meetings.
 */
export const WAR_ROOM_SEATS: Record<string, TileCoord> = {
  //         row 17 = above table (chairs facing down)
  billy:   { col: 22, row: 17 },   // head of table — top center
  patrik:  { col: 19, row: 17 },   // top left
  isaac:   { col: 25, row: 17 },   // top right
  //         row 23 = below table (chairs facing up)
  marcos:  { col: 19, row: 23 },   // bottom left
  charlie: { col: 22, row: 23 },   // bottom center
  sandra:  { col: 25, row: 23 },   // bottom right
};

// -- Office Furniture ─────────────────────────────────────────────────────────
//
// Sprites used (all visually verified in sprite-debugger 2026-03-18):
//   desk-wood-2wide  : Generic sheet col=0 row=5 w=2 h=3 (orange wood top-down desk)
//   chair-office     : Generic sheet col=4 row=5 w=2 h=2 (round golden chair)
//   bookshelf-2tall  : Generic sheet col=0 row=8 w=2 h=3 (dark storage unit)
//   plant-large      : Living Room sheet col=10 row=0 w=2 h=2 (confirmed working)
//   couch-2wide      : Living Room sheet col=2 row=0 w=3 h=2 (sofa)
//   conf-table       : Conference sheet col=0 row=2 w=5 h=3 (conference table)
//
// Layout design: desk against north wall, chair at seatTile, bookshelf on one
// wall, plant in opposite corner. Collision footprints match sprite visual size.

// ── Cozy Wood Cabin — all rooms clean (no furniture) ─────────────────────────

// -- Decoration Items ---------------------------------------------------------

export interface DecorationItem {
  roomId: string;
  key: string;
  col: number;
  row: number;
}

export const DECORATIONS: DecorationItem[] = [];

// -- Room Rugs ----------------------------------------------------------------

export interface RoomRug {
  roomId: string;
  col: number;
  row: number;
  w: number;
  h: number;
  color: string;
  borderColor: string;
}

export const ROOM_RUGS: RoomRug[] = [
  // Agent office rugs: warm earth tones under desk/chair area (3×4 tiles)
  { roomId: 'isaac',   col: 6,  row: 4,  w: 4, h: 4, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'patrik',  col: 35, row: 4,  w: 4, h: 4, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'marcos',  col: 5,  row: 16, w: 4, h: 4, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'sandra',  col: 35, row: 16, w: 4, h: 4, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'charlie', col: 5,  row: 28, w: 4, h: 4, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'wendy',   col: 35, row: 28, w: 4, h: 4, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  // Billy's exec office: larger darker rug
  { roomId: 'billy',   col: 19, row: 4,  w: 6, h: 5, color: 'rgba(80, 60, 40, 0.15)',  borderColor: 'rgba(80, 60, 40, 0.3)'  },
  // War Room: blue-grey carpet accent under conference table
  { roomId: 'war-room', col: 19, row: 17, w: 8, h: 8, color: 'rgba(60, 80, 110, 0.10)', borderColor: 'rgba(60, 80, 110, 0.20)' },
];

// -- Recreation Area Bounds ---------------------------------------------------

export const REC_AREA_BOUNDS = {
  // Open floor area below Board Room south wall (rows 29+, cols 15-28)
  minCol: 15, maxCol: 28,
  minRow: 29, maxRow: 37,
} as const;

export function isRecAreaTile(col: number, row: number): boolean {
  return (
    col >= REC_AREA_BOUNDS.minCol && col <= REC_AREA_BOUNDS.maxCol &&
    row >= REC_AREA_BOUNDS.minRow && row <= REC_AREA_BOUNDS.maxRow
  );
}

// -- Per-tile style overrides (set by editor) ---------------------------------

/** Maps "col,row" → atlas key for custom floor/wall styles painted by the editor. */
export const TILE_STYLES: Map<string, string> = new Map();

/** Set a custom atlas style for a tile. */
export function setTileStyle(col: number, row: number, atlasKey: string): void {
  TILE_STYLES.set(`${col},${row}`, atlasKey);
}

/** Get the custom atlas style for a tile, or null if using default. */
export function getTileStyle(col: number, row: number): string | null {
  return TILE_STYLES.get(`${col},${row}`) ?? null;
}

/** Clear a tile's custom style. */
export function clearTileStyle(col: number, row: number): void {
  TILE_STYLES.delete(`${col},${row}`);
}

// -- Room Lookup --------------------------------------------------------------

// ── Mutable Setters (used by layout editor) ─────────────────────────────────

/** Set a single tile type in the map. */
export function setTile(col: number, row: number, type: TileType): void {
  if (row >= 0 && row < OFFICE_TILE_MAP.length && col >= 0 && col < OFFICE_TILE_MAP[0]!.length) {
    OFFICE_TILE_MAP[row]![col] = type;
  }
}

/** Returns all seat tiles, War Room seats, BILLY stand tiles, and filing cabinet tiles as collision exemptions. */
export function getCollisionExemptions(): TileCoord[] {
  const exemptions: TileCoord[] = [];
  for (const room of ROOMS) {
    exemptions.push(room.seatTile);
    exemptions.push(room.billyStandTile);
  }
  for (const seat of Object.values(WAR_ROOM_SEATS)) exemptions.push(seat);
  // Filing cabinets are solid furniture but agents must be able to walk past them
  exemptions.push({ col: 5,  row: 5  }); // isaac
  exemptions.push({ col: 41, row: 5  }); // patrik
  exemptions.push({ col: 5,  row: 17 }); // marcos
  exemptions.push({ col: 41, row: 17 }); // sandra
  exemptions.push({ col: 5,  row: 29 }); // charlie
  exemptions.push({ col: 41, row: 29 }); // wendy
  return exemptions;
}

/** Add a furniture item, optionally at a specific index (for undo). */
export function addFurniture(item: FurnitureItem, atIndex?: number): void {
  if (atIndex !== undefined && atIndex >= 0 && atIndex <= FURNITURE.length) {
    FURNITURE.splice(atIndex, 0, item);
  } else {
    FURNITURE.push(item);
  }
  rebuildCollisionOverlay(
    FURNITURE,
    getCollisionExemptions(),
    OFFICE_TILE_MAP.length,
    OFFICE_TILE_MAP[0]?.length ?? 0,
  );
}

/** Remove furniture at a specific array index. */
export function removeFurnitureAt(index: number): void {
  if (index >= 0 && index < FURNITURE.length) {
    FURNITURE.splice(index, 1);
  }
  rebuildCollisionOverlay(
    FURNITURE,
    getCollisionExemptions(),
    OFFICE_TILE_MAP.length,
    OFFICE_TILE_MAP[0]?.length ?? 0,
  );
}

/** Cycle a furniture item's rotation by 90° clockwise. Returns the new rotation. */
export function rotateFurnitureAt(index: number): 0 | 90 | 180 | 270 {
  const item = FURNITURE[index];
  if (!item) return 0;
  const steps: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
  const current = item.rotation ?? 0;
  const next = steps[(steps.indexOf(current) + 1) % 4]!;
  item.rotation = next;
  return next;
}

/** Find furniture at a tile position, returning its array index or null. */
export function getFurnitureAt(col: number, row: number): number | null {
  for (let i = FURNITURE.length - 1; i >= 0; i--) {
    const f = FURNITURE[i]!;
    if (col >= f.col && col < f.col + f.width && row >= f.row && row < f.row + f.height) {
      return i;
    }
  }
  return null;
}

/** Add a decoration item. */
export function addDecoration(item: DecorationItem): void {
  DECORATIONS.push(item);
}

/** Remove a decoration by index. */
export function removeDecorationAt(index: number): void {
  if (index >= 0 && index < DECORATIONS.length) {
    DECORATIONS.splice(index, 1);
  }
}

/**
 * Expand or shrink the tile map from a specific edge.
 * Positive amount = add tiles, negative = remove tiles.
 * Shifts all room/furniture/decoration positions when adding to top or left.
 */
export function resizeGridEdge(edge: 'top' | 'bottom' | 'left' | 'right', amount: number): void {
  if (amount === 0) return;

  const oldRows = OFFICE_TILE_MAP.length;
  const oldCols = oldRows > 0 ? OFFICE_TILE_MAP[0]!.length : 0;

  if (edge === 'bottom') {
    if (amount > 0) {
      for (let i = 0; i < amount; i++) {
        const row: TileType[] = [];
        for (let c = 0; c < oldCols; c++) row.push(F);
        OFFICE_TILE_MAP.push(row);
      }
    } else {
      const remove = Math.min(-amount, oldRows - 1);
      OFFICE_TILE_MAP.length = oldRows - remove;
    }
  } else if (edge === 'top') {
    if (amount > 0) {
      for (let i = 0; i < amount; i++) {
        const row: TileType[] = [];
        for (let c = 0; c < oldCols; c++) row.push(F);
        OFFICE_TILE_MAP.unshift(row);
      }
      // Shift all positioned elements down
      shiftPositions(0, amount);
    } else {
      const remove = Math.min(-amount, oldRows - 1);
      OFFICE_TILE_MAP.splice(0, remove);
      shiftPositions(0, -remove);
    }
  } else if (edge === 'right') {
    if (amount > 0) {
      for (const row of OFFICE_TILE_MAP) {
        for (let i = 0; i < amount; i++) row.push(F);
      }
    } else {
      const remove = Math.min(-amount, oldCols - 1);
      for (const row of OFFICE_TILE_MAP) {
        row.length = row.length - remove;
      }
    }
  } else if (edge === 'left') {
    if (amount > 0) {
      for (const row of OFFICE_TILE_MAP) {
        for (let i = 0; i < amount; i++) row.unshift(F);
      }
      shiftPositions(amount, 0);
    } else {
      const remove = Math.min(-amount, oldCols - 1);
      for (const row of OFFICE_TILE_MAP) {
        row.splice(0, remove);
      }
      shiftPositions(-remove, 0);
    }
  }
}

/** Shift all room, furniture, and decoration positions by (dCol, dRow). */
function shiftPositions(dCol: number, dRow: number): void {
  for (const room of ROOMS) {
    room.tileRect.col += dCol;
    room.tileRect.row += dRow;
    room.doorTile.col += dCol;
    room.doorTile.row += dRow;
    room.seatTile.col += dCol;
    room.seatTile.row += dRow;
    room.billyStandTile.col += dCol;
    room.billyStandTile.row += dRow;
  }
  for (const f of FURNITURE) {
    f.col += dCol;
    f.row += dRow;
  }
  for (const d of DECORATIONS) {
    d.col += dCol;
    d.row += dRow;
  }
  for (const key of Object.keys(WAR_ROOM_SEATS)) {
    WAR_ROOM_SEATS[key]!.col += dCol;
    WAR_ROOM_SEATS[key]!.row += dRow;
  }
}

// ── Room Lookup ─────────────────────────────────────────────────────────────

export function getRoomAtTile(col: number, row: number): Room | null {
  for (const room of ROOMS) {
    const r = room.tileRect;
    if (
      col >= r.col &&
      col < r.col + r.width &&
      row >= r.row &&
      row < r.row + r.height
    ) {
      return room;
    }
  }
  return null;
}
