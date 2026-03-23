/**
 * Depth sorting for unified Y-sorted rendering.
 *
 * Merges furniture, decorations, and characters into a single sorted
 * draw list ordered back-to-front by their bottom tile row (baseRow).
 * At the same row, furniture draws before characters (priority tie-break).
 */
import { TILE_SIZE } from './types';
import type { Character } from './types';
import type { FurnitureItem, DecorationItem } from './officeLayout';

export interface Renderable {
  /** Y-sort key: bottom tile row of this object's footprint */
  baseRow: number;
  /** Tie-breaking: 0 = furniture/decoration (behind), 1 = character (in front) at same row */
  priority: number;
  /** Draw this renderable -- assumes ctx already has setTransform applied */
  draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * Build a sorted list of all renderables (furniture + decorations + characters)
 * for back-to-front Y-sorted drawing.
 *
 * @param characters - Active characters to include
 * @param renderCharacterFn - Callback to draw a single character
 * @param _renderFurnitureItemFn - Reserved: furniture rendering now handled by pixelScene
 * @param _renderDecorationFn - Reserved: decoration rendering now handled by pixelScene
 * @returns Sorted array of Renderables (back-to-front)
 */
export function buildRenderables(
  characters: Character[],
  renderCharacterFn: (ctx: CanvasRenderingContext2D, ch: Character) => void,
  _renderFurnitureItemFn: (ctx: CanvasRenderingContext2D, item: FurnitureItem) => void,
  _renderDecorationFn: (ctx: CanvasRenderingContext2D, dec: DecorationItem) => void,
): Renderable[] {
  const list: Renderable[] = [];

  // ── Old BOILER-ROOM furniture/decorations SKIPPED ──────────────────
  // pixelScene (Layer 1b) now draws all room art procedurally.
  // Only characters are depth-sorted here.
  // for (const item of FURNITURE) { … }
  // for (const dec of DECORATIONS) { … }

  for (const ch of characters) {
    // Character foot is at bottom of their occupied tile (ch.y + TILE_SIZE).
    // baseRow uses foot position for Y-sort. The 32x32 sprite extends 16px
    // above ch.y but sorting is by feet, not head — correct for JRPG 3/4 depth.
    // 32x32 compatible: ch.y is the tile origin (top of occupied tile), not
    // sprite origin. The taller sprite draws above ch.y but foot position
    // (ch.y + TILE_SIZE) is unchanged, so baseRow calculation is correct.
    const footRow = ch.y / TILE_SIZE;
    list.push({
      baseRow: footRow + 1, // bottom edge (foot) is one tile below ch.y origin
      priority: 1,
      draw: (ctx) => renderCharacterFn(ctx, ch),
    });
  }

  // Sort by baseRow ascending (back to front), then priority (furniture before character at same row)
  list.sort((a, b) => a.baseRow - b.baseRow || a.priority - b.priority);
  return list;
}
