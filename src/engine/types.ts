/**
 * Canvas engine type definitions.
 * Contract for the entire tile-based top-down office renderer.
 */

// ── Tile Types ──────────────────────────────────────────────────────────────
// Numeric enum for fast tile map lookups in 2D array
export const enum TileType {
  VOID = 0,
  FLOOR = 1,
  WALL = 2,
  DOOR = 3,
}

// ── Constants ───────────────────────────────────────────────────────────────
/** Native tile size in pixels (displayed at 2x zoom as 32x32) */
export const TILE_SIZE = 16;

/** Character sprite draw width (32px — LimeZu 48px source scaled to 2 tiles) */
export const CHAR_SPRITE_W = 32;
/** Character sprite draw height (64px — LimeZu 96px source scaled proportionally) */
export const CHAR_SPRITE_H = 64;

/** Zoom levels below this threshold are treated as overview mode (no camera follow) */
export const ZOOM_OVERVIEW_THRESHOLD = 1.5;

/** Base walk speed in pixels/sec (~4 tiles/sec at 16px tiles) */
export const WALK_SPEED = 64;

/** Fast walk speed for long-distance traversals */
export const WALK_SPEED_FAST = 128;

/** Tile distance threshold before ramping to fast speed (4 for compact layout) */
export const SPEED_RAMP_TILES = 4;

/** Seconds per walk animation frame */
export const WALK_FRAME_DURATION = 0.15;

/** Seconds per work animation frame */
export const WORK_FRAME_DURATION = 0.5;

// ── Coordinate Types ────────────────────────────────────────────────────────
export interface TileCoord {
  col: number;
  row: number;
}

// ── Direction & State ───────────────────────────────────────────────────────
export type Direction = 'up' | 'down' | 'left' | 'right';
export type CharacterState = 'idle' | 'walk' | 'work' | 'sit';

// ── Room ────────────────────────────────────────────────────────────────────
export interface Room {
  id: string;
  name: string;
  tileRect: {
    col: number;
    row: number;
    width: number;
    height: number;
  };
  doorTile: TileCoord;
  seatTile: TileCoord;
  billyStandTile: TileCoord;
}

// ── Character ───────────────────────────────────────────────────────────────
export interface Character {
  id: string;
  /** Interpolated pixel X position */
  x: number;
  /** Interpolated pixel Y position */
  y: number;
  /** Current grid column */
  tileCol: number;
  /** Current grid row */
  tileRow: number;
  state: CharacterState;
  direction: Direction;
  /** Current animation frame index */
  frame: number;
  /** Seconds since last frame change */
  frameTimer: number;
  /** BFS path to walk (array of tile coords, excluding start) */
  path: TileCoord[];
  /** Lerp progress 0..1 between current tile and next tile in path */
  moveProgress: number;
  /** Current walk speed in pixels/sec */
  speed: number;
}

// ── Camera ──────────────────────────────────────────────────────────────────
export interface Camera {
  /** Current camera X offset (pixels) */
  x: number;
  /** Current camera Y offset (pixels) */
  y: number;
  /** Current zoom level (float, e.g. 1.0, 1.5, 2.0) */
  zoom: number;
  /** Target X for smooth lerp */
  targetX: number;
  /** Target Y for smooth lerp */
  targetY: number;
  /** Character ID that camera follows, or null for free camera */
  followTarget: string | null;
}

// ── Sprite ──────────────────────────────────────────────────────────────────
export interface SpriteFrame {
  /** Source X in sprite sheet */
  x: number;
  /** Source Y in sprite sheet */
  y: number;
  /** Frame width in pixels */
  w: number;
  /** Frame height in pixels */
  h: number;
}
