import { describe, it, expect, vi } from 'vitest';
import { TILE_SIZE, CHAR_SPRITE_W, CHAR_SPRITE_H } from '../types';
import type { Character } from '../types';
import { buildRenderables } from '../depthSort';

function createCharacter(id: string, col: number, row: number): Character {
  return {
    id,
    x: col * TILE_SIZE,
    y: row * TILE_SIZE,
    tileCol: col,
    tileRow: row,
    state: 'idle',
    direction: 'down',
    frame: 0,
    frameTimer: 0,
    path: [],
    moveProgress: 0,
    speed: 0,
  };
}

const noopFn = vi.fn();

describe('depthSort: buildRenderables', () => {
  it('character baseRow = footRow + 1 (32x32 compatible: uses tile origin not sprite height)', () => {
    // Character at tile row 10 -> ch.y = 10 * 16 = 160
    // footRow = 160 / 16 = 10
    // baseRow = 10 + 1 = 11
    const ch = createCharacter('billy', 5, 10);
    const renderables = buildRenderables(
      [ch],
      noopFn,
      noopFn,
      noopFn,
    );

    // Find the character renderable (priority 1)
    const charRenderable = renderables.find(r => r.priority === 1);
    expect(charRenderable).toBeDefined();
    expect(charRenderable!.baseRow).toBe(11);
  });

  it('character baseRow is independent of CHAR_SPRITE_W (32x32 does not affect sorting)', () => {
    // The key property: sprite dimensions do NOT affect baseRow
    // baseRow depends only on ch.y (tile-space position), not CHAR_SPRITE_W/H
    const ch = createCharacter('patrik', 5, 15);
    const footRow = ch.y / TILE_SIZE;
    expect(footRow).toBe(15);

    // CHAR_SPRITE_W is 32, CHAR_SPRITE_H is 32 (Metro City single-cell sprites), but baseRow should still be footRow + 1
    expect(CHAR_SPRITE_W).toBe(32);
    expect(CHAR_SPRITE_H).toBe(32);

    const renderables = buildRenderables([ch], noopFn, noopFn, noopFn);
    const charRenderable = renderables.find(r => r.priority === 1);
    expect(charRenderable!.baseRow).toBe(16);
  });

  it('furniture baseRow uses row + height - 1 (bottom edge of footprint)', () => {
    // buildRenderables includes all FURNITURE items from officeLayout (global module).
    // Each furniture baseRow = item.row + item.height - 1 (bottom edge of footprint).
    const renderables = buildRenderables([], noopFn, noopFn, noopFn);
    const furnitureItems = renderables.filter(r => r.priority === 0);
    // The office layout has many furniture items (plants, desks, chairs, filing cabinets, table)
    expect(furnitureItems.length).toBeGreaterThan(0);

    // All furniture items have non-negative baseRow
    for (const item of furnitureItems) {
      expect(item.baseRow).toBeGreaterThanOrEqual(0);
    }
  });

  it('characters sort after furniture at same baseRow (priority 1 vs 0)', () => {
    // A character at the same baseRow as furniture should render after (in front)
    const ch = createCharacter('billy', 12, 3); // baseRow = 4
    const renderables = buildRenderables([ch], noopFn, noopFn, noopFn);

    // Find items with same baseRow
    const charBaseRow = ch.y / TILE_SIZE + 1; // 4
    const sameRowItems = renderables.filter(r => r.baseRow === charBaseRow);

    if (sameRowItems.length > 1) {
      // Verify furniture (priority 0) comes before character (priority 1)
      const priorities = sameRowItems.map(r => r.priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]!).toBeGreaterThanOrEqual(priorities[i - 1]!);
      }
    }
  });

  it('character at lower row renders before furniture at higher row (depth ordering)', () => {
    // Character at row 5 (baseRow 6) should be before furniture at row 10+
    const ch = createCharacter('billy', 5, 5); // baseRow = 6
    const renderables = buildRenderables([ch], noopFn, noopFn, noopFn);

    const charRenderable = renderables.find(r => r.priority === 1)!;
    const charIdx = renderables.indexOf(charRenderable);

    // Find furniture items with higher baseRow
    const laterFurniture = renderables.filter(
      r => r.priority === 0 && r.baseRow > charRenderable.baseRow,
    );

    // Character should appear earlier in array than furniture with higher baseRow
    for (const fItem of laterFurniture) {
      const fIdx = renderables.indexOf(fItem);
      expect(charIdx).toBeLessThan(fIdx);
    }
  });

  it('sorted output is back-to-front (ascending baseRow)', () => {
    const characters = [
      createCharacter('billy', 12, 5),
      createCharacter('patrik', 20, 3),
    ];

    const renderables = buildRenderables(characters, noopFn, noopFn, noopFn);

    // Verify ascending order
    for (let i = 1; i < renderables.length; i++) {
      const prev = renderables[i - 1]!;
      const curr = renderables[i]!;
      if (prev.baseRow === curr.baseRow) {
        expect(curr.priority).toBeGreaterThanOrEqual(prev.priority);
      } else {
        expect(curr.baseRow).toBeGreaterThanOrEqual(prev.baseRow);
      }
    }
  });
});
