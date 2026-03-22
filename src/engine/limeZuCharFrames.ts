/**
 * LimeZu Premade character frame mapping.
 *
 * Sheet dimensions: 2688×1920 = 56 cols × 20 rows
 * Cell size: 48px wide × 96px tall
 *
 * Verified by pixel scanning billy.png:
 *   - Column pitch: 48px (frame-to-frame spacing)
 *   - Row pitch: 96px (band-to-band spacing)
 *   - Character content: ~36-42px wide, ~69px tall within each cell
 *
 * Row layout:
 *   Row 0:  Idle — 4 frames: down(0), left(1), right(2), up(3)
 *   Row 1:  Walk cycle — 4 directions × 6 frames packed:
 *           down(0-5), left(6-11), right(12-17), up(18-23)
 *   Row 2:  Walk variant / large animations
 *   Row 3:  Sit / seated direction frames
 *   Row 4+: Additional animations (phone, carry, emote, etc.)
 */
import type { SpriteFrame, CharacterState, Direction } from './types';

/** Source frame cell width (48px) */
const W = 48;
/** Source frame cell height (96px) */
const H = 96;

/**
 * Create a SpriteFrame for a single 48×96 cell.
 * @param col - Column index (0-based, 56 max)
 * @param row - Row index (0-based, 20 max)
 */
function frame(col: number, row: number): SpriteFrame {
  return { x: col * W, y: row * H, w: W, h: H };
}

// ── Character Sheet Paths ────────────────────────────────────────────────────

const SPRITES_PATH = '/sprites';

/** Maps character IDs to their composited character sheet paths. */
export const CHAR_SHEET_PATHS: Record<string, string> = {
  billy:   `${SPRITES_PATH}/billy.png`,
  patrik:  `${SPRITES_PATH}/patrik.png`,
  marcos:  `${SPRITES_PATH}/marcos.png`,
  sandra:  `${SPRITES_PATH}/sandra.png`,
  isaac:   `${SPRITES_PATH}/isaac.png`,
  wendy:   `${SPRITES_PATH}/wendy.png`,
  charlie: `${SPRITES_PATH}/charlie.png`,
};

// ── Character Frame Mapping ──────────────────────────────────────────────────

/** Direction order in LimeZu sheets: down, left, right, up */
const DIR_ORDER: Direction[] = ['down', 'left', 'right', 'up'];

/**
 * Build frame arrays for a row where directions are packed sequentially.
 * @param row - Sheet row index
 * @param framesPerDir - Number of frames per direction
 */
function buildPackedRow(row: number, framesPerDir: number): Record<Direction, SpriteFrame[]> {
  const result = {} as Record<Direction, SpriteFrame[]>;
  for (let d = 0; d < DIR_ORDER.length; d++) {
    const dir = DIR_ORDER[d]!;
    const startCol = d * framesPerDir;
    const frames: SpriteFrame[] = [];
    for (let f = 0; f < framesPerDir; f++) {
      frames.push(frame(startCol + f, row));
    }
    result[dir] = frames;
  }
  return result;
}

/**
 * Character frame mapping for all states and directions.
 * Shared across all LimeZu premade characters (same sheet layout).
 *
 * Source frames are 48×96 — the renderer scales them to CHAR_SPRITE_W × CHAR_SPRITE_H.
 */
export const LIMEZU_CHARACTER_FRAMES: Record<
  CharacterState | 'talk',
  Record<Direction, SpriteFrame[]>
> = {
  // Idle: row 0 — 4 frames, one per direction
  idle: {
    down:  [frame(0, 0)],
    left:  [frame(1, 0)],
    right: [frame(2, 0)],
    up:    [frame(3, 0)],
  },

  // Walk: row 1 — 6 frames per direction, packed sequentially
  walk: buildPackedRow(1, 6),

  // Work: use first walk frame per direction (row 1) as working pose
  work: {
    down:  [frame(0, 1)],
    left:  [frame(6, 1)],
    right: [frame(12, 1)],
    up:    [frame(18, 1)],
  },

  // Sit: use idle (row 0) — row 3 contains head-only "peek above desk" sprites
  sit: {
    down:  [frame(0, 0)],
    left:  [frame(1, 0)],
    right: [frame(2, 0)],
    up:    [frame(3, 0)],
  },

  // Talk: same as idle
  talk: {
    down:  [frame(0, 0)],
    left:  [frame(1, 0)],
    right: [frame(2, 0)],
    up:    [frame(3, 0)],
  },
};
