// ═══════════════════════════════════════════════════════════════════════════════
// Tile map — RPG Maker MZ–compatible grid (32×28 tiles at 48px/tile).
//
// Room layout:
//   [Isaac 8×7]  [Billy 12×7]  [Patrik 8×7]     ← rows 1-7
//             [ hallway rows 8-9 ]
//   [Marcos 8×8] [BOARD 12×8] [Sandra 8×8]      ← rows 10-17
//             [ hallway rows 18-19 ]
//   [Charlie 8×7] [open floor] [Wendy 8×7]      ← rows 20-26
//
// Vertical hallways: cols 8-9 (left), cols 22-23 (right), rows 8-19
// ═══════════════════════════════════════════════════════════════════════════════

import { TileType } from './types';
import type { Room, TileCoord } from './types';
import { rebuildCollisionOverlay } from './tileMap';

const F = TileType.FLOOR;
const W = TileType.WALL;
const D = TileType.DOOR;

const GRID_COLS = 32;
const GRID_ROWS = 28;

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

  // Fill border with VOID to mark the map edges (RPG Maker convention)
  fill(0, 0, GRID_COLS, 1, W);   // top border
  fill(0, GRID_ROWS - 1, GRID_COLS, 1, W); // bottom border
  fill(0, 0, 1, GRID_ROWS, W);   // left border (gets overwritten by rooms touching col 0)
  fill(GRID_COLS - 1, 0, 1, GRID_ROWS, W); // right border

  // ── TOP ROW (rows 1-7) ────────────────────────────────────────────────────
  room(0, 1, 8, 7);     // Isaac:   cols  0-7,   rows 1-7
  room(10, 1, 12, 7);   // Billy:   cols 10-21,  rows 1-7
  room(24, 1, 8, 7);    // Patrik:  cols 24-31,  rows 1-7

  // ── MID ROW (rows 10-17) ──────────────────────────────────────────────────
  room(0, 10, 8, 8);    // Marcos:  cols  0-7,   rows 10-17
  room(10, 10, 12, 8);  // Board:   cols 10-21,  rows 10-17
  room(24, 10, 8, 8);   // Sandra:  cols 24-31,  rows 10-17

  // ── BOTTOM ROW (rows 20-26) ───────────────────────────────────────────────
  room(0, 20, 8, 7);    // Charlie: cols  0-7,   rows 20-26
  room(24, 20, 8, 7);   // Wendy:   cols 24-31,  rows 20-26

  // ── DOORS ─────────────────────────────────────────────────────────────────
  // Top row: bottom walls (row 7)
  map[7]![4] = D;                         // Isaac bottom door
  map[7]![15] = D; map[7]![16] = D;       // Billy bottom door (double)
  map[7]![28] = D;                         // Patrik bottom door

  // Mid row: side doors
  map[13]![7] = D; map[14]![7] = D;       // Marcos right wall door
  map[13]![10] = D; map[14]![10] = D;     // Board left wall door
  map[13]![24] = D; map[14]![24] = D;     // Sandra left wall door

  // Bottom row: side doors
  map[23]![7] = D; map[24]![7] = D;       // Charlie right wall door
  map[23]![24] = D; map[24]![24] = D;     // Wendy left wall door

  return map;
}

export const OFFICE_TILE_MAP: TileType[][] = buildTileMap();

// -- Room Definitions ---------------------------------------------------------

export const ROOMS: Room[] = [
  {
    id: 'isaac',
    name: "Isaac's Office",
    tileRect: { col: 0, row: 1, width: 8, height: 7 },
    doorTile: { col: 4, row: 7 },
    seatTile: { col: 3, row: 5 },
    billyStandTile: { col: 4, row: 5 },
    fileTableTile: { col: 6, row: 5 },
  },
  {
    id: 'billy',
    name: "BILLY's Office",
    tileRect: { col: 10, row: 1, width: 12, height: 7 },
    doorTile: { col: 15, row: 7 },
    seatTile: { col: 15, row: 5 },
    billyStandTile: { col: 16, row: 5 },
    fileTableTile: { col: 12, row: 5 },
  },
  {
    id: 'patrik',
    name: "Patrik's Office",
    tileRect: { col: 24, row: 1, width: 8, height: 7 },
    doorTile: { col: 28, row: 7 },
    seatTile: { col: 28, row: 5 },
    billyStandTile: { col: 27, row: 5 },
    fileTableTile: { col: 25, row: 5 },
  },
  {
    id: 'marcos',
    name: "Marcos's Office",
    tileRect: { col: 0, row: 10, width: 8, height: 8 },
    doorTile: { col: 7, row: 13 },
    seatTile: { col: 3, row: 15 },
    billyStandTile: { col: 4, row: 15 },
    fileTableTile: { col: 6, row: 15 },
  },
  {
    id: 'war-room',
    name: 'Board Room',
    tileRect: { col: 10, row: 10, width: 12, height: 8 },
    doorTile: { col: 10, row: 13 },
    seatTile: { col: 15, row: 14 },
    billyStandTile: { col: 15, row: 12 },
    fileTableTile: { col: 15, row: 14 },
  },
  {
    id: 'sandra',
    name: "Sandra's Office",
    tileRect: { col: 24, row: 10, width: 8, height: 8 },
    doorTile: { col: 24, row: 13 },
    seatTile: { col: 28, row: 15 },
    billyStandTile: { col: 27, row: 15 },
    fileTableTile: { col: 25, row: 15 },
  },
  {
    id: 'charlie',
    name: "Charlie's Office",
    tileRect: { col: 0, row: 20, width: 8, height: 7 },
    doorTile: { col: 7, row: 23 },
    seatTile: { col: 3, row: 24 },
    billyStandTile: { col: 4, row: 24 },
    fileTableTile: { col: 6, row: 24 },
  },
  {
    id: 'wendy',
    name: "Wendy's Coaching Room",
    tileRect: { col: 24, row: 20, width: 8, height: 7 },
    doorTile: { col: 24, row: 23 },
    seatTile: { col: 28, row: 24 },
    billyStandTile: { col: 27, row: 24 },
    fileTableTile: { col: 25, row: 22 },
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
   */
  spriteRows?: number;
}

/** Default furniture — RPG Maker scale (rooms are 6×5 / 10×5 interior). */
export const DEFAULT_FURNITURE: FurnitureItem[] = [
  // ── Isaac's Office (interior cols 1-6, rows 2-6) ──────────────────────────
  { roomId: 'isaac',   type: 'desk',      col: 2,  row: 2,  width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'isaac',   type: 'chair',     col: 3,  row: 4,  width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'isaac',   type: 'bookshelf', col: 1,  row: 2,  width: 1, height: 2, atlasKey: 'bookshelf-2tall' },
  { roomId: 'isaac',   type: 'plant',     col: 6,  row: 2,  width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: 'isaac',   type: 'filing-cabinet', col: 5, row: 2, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Billy's Office (interior cols 11-20, rows 2-6) ────────────────────────
  { roomId: 'billy',   type: 'desk',      col: 14, row: 2,  width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'billy',   type: 'chair',     col: 15, row: 4,  width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'billy',   type: 'bookshelf', col: 11, row: 2,  width: 1, height: 2, atlasKey: 'bookshelf-2tall' },
  { roomId: 'billy',   type: 'plant',     col: 20, row: 2,  width: 1, height: 1, atlasKey: 'plant-large-g' },
  { roomId: 'billy',   type: 'monitor',   col: 17, row: 2,  width: 2, height: 1, atlasKey: 'monitor' },
  { roomId: 'billy',   type: 'couch',     col: 11, row: 5,  width: 2, height: 1, atlasKey: 'couch-2wide' },

  // ── Patrik's Office (interior cols 25-30, rows 2-6) ───────────────────────
  { roomId: 'patrik',  type: 'desk',      col: 27, row: 2,  width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'patrik',  type: 'chair',     col: 28, row: 4,  width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'patrik',  type: 'bookshelf', col: 25, row: 2,  width: 1, height: 2, atlasKey: 'bookshelf-2tall' },
  { roomId: 'patrik',  type: 'plant',     col: 30, row: 2,  width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: 'patrik',  type: 'filing-cabinet', col: 30, row: 6, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Marcos's Office (interior cols 1-6, rows 11-16) ───────────────────────
  { roomId: 'marcos',  type: 'desk',      col: 2,  row: 11, width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'marcos',  type: 'chair',     col: 3,  row: 13, width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'marcos',  type: 'bookshelf', col: 1,  row: 11, width: 1, height: 2, atlasKey: 'bookshelf-2tall' },
  { roomId: 'marcos',  type: 'plant',     col: 6,  row: 11, width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: 'marcos',  type: 'filing-cabinet', col: 1, row: 14, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Sandra's Office (interior cols 25-30, rows 11-16) ─────────────────────
  { roomId: 'sandra',  type: 'desk',      col: 27, row: 11, width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'sandra',  type: 'chair',     col: 28, row: 13, width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'sandra',  type: 'bookshelf', col: 30, row: 11, width: 1, height: 2, atlasKey: 'bookshelf-2tall' },
  { roomId: 'sandra',  type: 'plant',     col: 25, row: 11, width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: 'sandra',  type: 'filing-cabinet', col: 30, row: 14, width: 1, height: 1, atlasKey: 'filing-cabinet' },

  // ── Charlie's Office (interior cols 1-6, rows 21-25) ──────────────────────
  { roomId: 'charlie', type: 'desk',      col: 2,  row: 21, width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'charlie', type: 'chair',     col: 3,  row: 23, width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'charlie', type: 'bookshelf', col: 1,  row: 21, width: 1, height: 2, atlasKey: 'bookshelf-2tall' },
  { roomId: 'charlie', type: 'plant',     col: 6,  row: 21, width: 1, height: 1, atlasKey: 'plant-potted' },

  // ── Wendy's Coaching Room (interior cols 25-30, rows 21-25) ───────────────
  { roomId: 'wendy',   type: 'desk',      col: 27, row: 21, width: 2, height: 2, atlasKey: 'desk-wood-2wide' },
  { roomId: 'wendy',   type: 'chair',     col: 28, row: 23, width: 1, height: 1, atlasKey: 'chair-office' },
  { roomId: 'wendy',   type: 'couch',     col: 25, row: 21, width: 2, height: 1, atlasKey: 'couch-2wide' },
  { roomId: 'wendy',   type: 'plant',     col: 30, row: 21, width: 1, height: 1, atlasKey: 'plant-potted' },

  // ── Board Room (conference table centered) ─────────────────────────────────
  { roomId: 'war-room', type: 'table',    col: 13, row: 12, width: 4, height: 3, atlasKey: 'conf-table', spriteRows: 3 },
  { roomId: 'war-room', type: 'whiteboard', col: 11, row: 11, width: 2, height: 1, atlasKey: 'whiteboard' },

  // ── HALLWAY PLANTS — corridor junctions ────────────────────────────────────
  { roomId: '',        type: 'plant',     col: 9,  row: 8,  width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: '',        type: 'plant',     col: 22, row: 8,  width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: '',        type: 'plant',     col: 9,  row: 19, width: 1, height: 1, atlasKey: 'plant-potted' },
  { roomId: '',        type: 'plant',     col: 22, row: 19, width: 1, height: 1, atlasKey: 'plant-potted' },
];

export const FURNITURE: FurnitureItem[] = [...DEFAULT_FURNITURE];


// -- War Room Seats -----------------------------------------------------------

/**
 * Board Room table: cols 13-16, rows 12-14.
 * Seats placed AROUND the table.
 * Billy at head (top center). Wendy does not attend board meetings.
 */
export const WAR_ROOM_SEATS: Record<string, TileCoord> = {
  billy:   { col: 15, row: 11 },   // head of table — top center
  patrik:  { col: 13, row: 11 },   // top left
  isaac:   { col: 17, row: 11 },   // top right
  marcos:  { col: 13, row: 16 },   // bottom left
  charlie: { col: 15, row: 16 },   // bottom center
  sandra:  { col: 17, row: 16 },   // bottom right
};

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
  { roomId: 'isaac',   col: 2,  row: 3,  w: 4, h: 3, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'patrik',  col: 26, row: 3,  w: 4, h: 3, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'marcos',  col: 2,  row: 12, w: 4, h: 3, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'sandra',  col: 26, row: 12, w: 4, h: 3, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'charlie', col: 2,  row: 22, w: 4, h: 3, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'wendy',   col: 26, row: 22, w: 4, h: 3, color: 'rgba(139, 90, 43, 0.12)', borderColor: 'rgba(139, 90, 43, 0.25)' },
  { roomId: 'billy',   col: 13, row: 3,  w: 5, h: 3, color: 'rgba(80, 60, 40, 0.15)',  borderColor: 'rgba(80, 60, 40, 0.3)'  },
  { roomId: 'war-room', col: 12, row: 12, w: 6, h: 4, color: 'rgba(60, 80, 110, 0.10)', borderColor: 'rgba(60, 80, 110, 0.20)' },
];

// -- Recreation Area Bounds ---------------------------------------------------

export const REC_AREA_BOUNDS = {
  minCol: 10, maxCol: 21,
  minRow: 20, maxRow: 26,
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

// ── Mutable Setters (used by layout editor) ─────────────────────────────────

/** Set a single tile type in the map. */
export function setTile(col: number, row: number, type: TileType): void {
  if (row >= 0 && row < OFFICE_TILE_MAP.length && col >= 0 && col < OFFICE_TILE_MAP[0]!.length) {
    OFFICE_TILE_MAP[row]![col] = type;
  }
}

/** Returns all seat tiles, War Room seats, BILLY stand tiles as collision exemptions. */
export function getCollisionExemptions(): TileCoord[] {
  const exemptions: TileCoord[] = [];
  for (const room of ROOMS) {
    exemptions.push(room.seatTile);
    exemptions.push(room.billyStandTile);
  }
  for (const seat of Object.values(WAR_ROOM_SEATS)) exemptions.push(seat);

  // Boardroom walking corridors around conference table
  const warRoom = ROOMS.find((r) => r.id === 'war-room');
  if (warRoom) {
    const interiorStart = warRoom.tileRect.col + 1;
    const interiorEnd   = warRoom.tileRect.col + warRoom.tileRect.width - 2;
    for (let c = interiorStart; c <= interiorEnd; c++) {
      exemptions.push({ col: c, row: 11 }); // above table
      exemptions.push({ col: c, row: 16 }); // below table
    }
  }

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
