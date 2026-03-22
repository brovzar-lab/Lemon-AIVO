/**
 * Sprite atlas coordinate maps for character sprite sheets.
 *
 * Phase 14: CHARACTER_FRAMES uses LimeZu premade character sheet layout
 * via LIMEZU_CHARACTER_FRAMES. All environment/furniture/decoration atlas
 * maps live in limeZuAtlas.ts (LIMEZU_ATLAS).
 *
 * LimeZu character sheet layout (32x32 premade, 56 cols x 41 rows):
 *   - Row 0: idle preview (4 frames: down, left, right, up)
 *   - Row 2: walk cycle (6 frames per direction, packed sequentially)
 *   - Row 6: phone animation (work state)
 *   - Each frame is 32x32 pixels (CHAR_SPRITE_W x CHAR_SPRITE_H)
 */
import type { CharacterState, Direction, SpriteFrame } from './types';
import { LIMEZU_CHARACTER_FRAMES } from './limeZuCharFrames';
import { CHAR_SHEET_PATHS } from './limeZuCharFrames';

// ── Character Frame Atlas ────────────────────────────────────────────────────

/**
 * Maps character animation states + directions to sprite frame coordinates.
 * Uses LimeZu 32x32 premade character sheet layout.
 * Since every premade character sheet has the same layout, these coordinates
 * are shared across all characters -- the renderer selects the correct sheet
 * by character ID.
 */
export const CHARACTER_FRAMES: Record<CharacterState | 'talk', Record<Direction, SpriteFrame[]>> =
  LIMEZU_CHARACTER_FRAMES;

/** Character IDs that have individual sprite sheets. */
export const CHARACTER_SHEET_NAMES: string[] = Object.keys(CHAR_SHEET_PATHS);
