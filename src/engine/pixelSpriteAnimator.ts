/**
 * Sprite sheet animator — loads full sprite sheets and extracts frames.
 * Ported from TEST PIXEL TEAM's spriteAnimator.js
 *
 * Sheet format: 2688×1920px, 48×48 grid (56 cols × 40 rows)
 * Characters span 2 ROWS tall (48×96px per frame)
 *
 * Layout:
 *   Row pair 0-1: Idle (col 0=left, 1=back, 2=right, 3=front)
 *   Row pair 2-3: Walk left/down (6 frames)
 *   Row pair 4-5: Walk right/up (6 frames)
 *   Row pair 6-7: Sleep / bed
 *   Row pair 8-9: Seated/working (col 0=left, 1=back, 2=right, 3=front, +more)
 */

const CW = 48;     // cell width
const CH = 96;     // cell height = 2 grid rows
const GRID_ROW = 48; // single grid row height

const AGENT_KEYS = ['billy', 'isaac', 'patrik', 'marcos', 'sandra', 'charlie', 'wendy'] as const;
export type AgentSpriteKey = typeof AGENT_KEYS[number];

/** Animation definitions: { row: top grid-row of pair, col, frames } */
interface AnimDef {
  row: number;
  col: number;
  frames: number;
}

const ANIMS: Record<string, AnimDef> = {
  idle_front: { row: 0, col: 3, frames: 1 },
  idle_left:  { row: 0, col: 0, frames: 1 },
  idle_right: { row: 0, col: 2, frames: 1 },
  idle_back:  { row: 0, col: 1, frames: 1 },
  walk_down:  { row: 2, col: 0, frames: 6 },
  walk_left:  { row: 2, col: 6, frames: 6 },
  walk_right: { row: 4, col: 0, frames: 6 },
  walk_up:    { row: 4, col: 6, frames: 6 },
  sit_front:  { row: 8, col: 3, frames: 1 },
  sit_left:   { row: 8, col: 0, frames: 1 },
  sit_right:  { row: 8, col: 2, frames: 1 },
  sit_back:   { row: 8, col: 1, frames: 1 },
};

const sheets: Record<string, HTMLImageElement> = {};
let loadedCount = 0;

export function preloadSpriteSheets(): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    AGENT_KEYS.forEach(name => {
      const img = new Image();
      img.onload = () => {
        sheets[name] = img;
        loadedCount++;
        if (loadedCount >= AGENT_KEYS.length && !resolved) {
          resolved = true;
          console.log(`✅ All ${loadedCount} sprite sheets loaded`);
          resolve();
        }
      };
      img.onerror = () => {
        console.warn(`❌ Failed to load sprite sheet: ${name}`);
        loadedCount++;
        if (loadedCount >= AGENT_KEYS.length && !resolved) {
          resolved = true;
          resolve();
        }
      };
      img.src = `/sprites/${name}.png`;
    });
    setTimeout(() => {
      if (!resolved) {
        console.warn('⏱️ Sprite sheet load timeout');
        resolved = true;
        resolve();
      }
    }, 5000);
  });
}

export function getSheet(agentKey: string): HTMLImageElement | null {
  return sheets[agentKey] || null;
}

/**
 * Draw a frame from the sprite sheet.
 * @param animName 'idle_front', 'sit_front', 'walk_down', etc.
 * @param frameIndex which frame (will wrap via modulo)
 * @param dx, dy destination top-left on canvas
 * @param dw, dh destination width and height (default 48×96)
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  agentKey: string,
  animName: string,
  frameIndex: number,
  dx: number,
  dy: number,
  dw?: number,
  dh?: number,
): boolean {
  const sheet = sheets[agentKey];
  if (!sheet) return false;

  const anim = ANIMS[animName];
  if (!anim) return false;

  const frame = frameIndex % anim.frames;
  const sx = (anim.col + frame) * CW;
  const sy = anim.row * GRID_ROW;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet,
    sx, sy, CW, CH,
    dx, dy, dw || CW, dh || CH,
  );
  return true;
}

export function sheetsReady(): boolean {
  return loadedCount >= AGENT_KEYS.length;
}
