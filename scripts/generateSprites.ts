/**
 * Generates pixel art sprite sheet PNGs for all characters and environment tiles.
 * Uses node-canvas to draw JRPG 3/4 perspective pixel art.
 *
 * Character frames: 24x32 pixels each (10 cols x 4 rows = 240x128 per sheet)
 * Environment tiles: 16x16 pixels each (16 cols x 12 rows = 256x192)
 *
 * Run: npx tsx scripts/generateSprites.ts
 * Output: public/sprites/{billy,patrik,marcos,sandra,isaac,wendy,environment}.png
 */
import { createCanvas, type Canvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const CHAR_W = 24;
const CHAR_H = 32;
const TILE = 16;
const SPRITE_DIR = resolve(dirname(import.meta.url.replace('file://', '')), '../public/sprites');

mkdirSync(SPRITE_DIR, { recursive: true });

// ── Character Color Definitions ──────────────────────────────────────────────

interface CharacterColors {
  skin: string;
  skinDark: string;
  hair: string;
  hairDark: string;
  clothing: string;
  clothingDark: string;
  accent: string;
  pants: string;
  pantsDark: string;
  shoes: string;
  outline: string;
}

const CHARACTERS: Record<string, CharacterColors> = {
  billy: {
    skin: '#c8956a',
    skinDark: '#a8754a',
    hair: '#2c2020',
    hairDark: '#1a1212',
    clothing: '#d4a030', // Gold/amber blazer
    clothingDark: '#b88820',
    accent: '#f0f0e8',  // Casual shirt underneath
    pants: '#3a3a48',
    pantsDark: '#2a2a38',
    shoes: '#2c2420',
    outline: '#1a1410',
  },
  patrik: {
    skin: '#c8a070',
    skinDark: '#a88050',
    hair: '#2a2018',
    hairDark: '#1a1208',
    clothing: '#2a3860', // Navy suit
    clothingDark: '#1a2848',
    accent: '#f0f0f0',  // White shirt
    pants: '#222e4a',
    pantsDark: '#181e38',
    shoes: '#1a1818',
    outline: '#101020',
  },
  marcos: {
    skin: '#b89060',
    skinDark: '#987040',
    hair: '#282020',
    hairDark: '#181010',
    clothing: '#3a3a40', // Charcoal suit
    clothingDark: '#2a2a30',
    accent: '#c0c0d0',  // Light shirt/tie
    pants: '#303038',
    pantsDark: '#202028',
    shoes: '#1c1c20',
    outline: '#101015',
  },
  sandra: {
    skin: '#b88860',
    skinDark: '#986840',
    hair: '#201810',
    hairDark: '#100800',
    clothing: '#10b981', // Emerald casual-smart
    clothingDark: '#0a9060',
    accent: '#f0f0e8',  // Rolled sleeves
    pants: '#3a3a3a',
    pantsDark: '#2a2a2a',
    shoes: '#282018',
    outline: '#081a10',
  },
  isaac: {
    skin: '#e0b888',
    skinDark: '#c09868',
    hair: '#4a3820',
    hairDark: '#3a2810',
    clothing: '#8a7050', // Casual cardigan
    clothingDark: '#6a5030',
    accent: '#f59e0b',   // Amber detail
    pants: '#404850',
    pantsDark: '#303840',
    shoes: '#302820',
    outline: '#201810',
  },
  wendy: {
    skin: '#c8a070',
    skinDark: '#a88050',
    hair: '#1a1010',
    hairDark: '#0a0000',
    clothing: '#8b6040', // Earth-tone outfit
    clothingDark: '#6b4020',
    accent: '#ec4899',   // Pink detail
    pants: '#5a4030',
    pantsDark: '#4a3020',
    shoes: '#2a2018',
    outline: '#181008',
  },
};

// ── Pixel Drawing Helpers ────────────────────────────────────────────────────

type Ctx = ReturnType<Canvas['getContext']>;

function px(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ── 24x32 JRPG Character Drawing ────────────────────────────────────────────

/**
 * Draw a 24x32 JRPG 3/4 perspective character frame.
 * Head: rows 0-9 (~10px), Torso: rows 10-19 (~10px), Legs/feet: rows 20-31 (~12px)
 * All coordinates relative to frame origin (ox, oy).
 */

function drawCharHead(
  ctx: Ctx, ox: number, oy: number, c: CharacterColors,
  dir: 'down' | 'left' | 'right' | 'up', bobY: number = 0,
): void {
  const hx = ox;
  const hy = oy + bobY;

  // 1px outline around head
  // Hair/head dome (rows 0-4): slightly larger chibi head
  // Front-facing (south) head

  if (dir === 'down') {
    // Hair dome (top)
    rect(ctx, hx + 8, hy + 0, 8, 1, c.hair);
    rect(ctx, hx + 7, hy + 1, 10, 1, c.hair);
    rect(ctx, hx + 6, hy + 2, 12, 1, c.hair);

    // Face area (rows 3-7)
    rect(ctx, hx + 6, hy + 3, 1, 5, c.hair);      // left hair side
    rect(ctx, hx + 17, hy + 3, 1, 5, c.hair);     // right hair side
    rect(ctx, hx + 7, hy + 3, 10, 5, c.skin);     // face fill

    // Eyes (row 5) - 2px wide each
    rect(ctx, hx + 9, hy + 5, 2, 1, '#222');
    rect(ctx, hx + 13, hy + 5, 2, 1, '#222');
    // Eye whites
    px(ctx, hx + 9, hy + 4, '#fff');
    px(ctx, hx + 13, hy + 4, '#fff');

    // Mouth (row 7)
    rect(ctx, hx + 11, hy + 7, 2, 1, c.skinDark);

    // Ears
    px(ctx, hx + 6, hy + 5, c.skin);
    px(ctx, hx + 17, hy + 5, c.skin);

    // Hair fringe detail
    rect(ctx, hx + 7, hy + 3, 3, 1, c.hair);
    rect(ctx, hx + 14, hy + 3, 3, 1, c.hair);

    // Chin / neck (row 8-9)
    rect(ctx, hx + 9, hy + 8, 6, 1, c.skin);
    rect(ctx, hx + 10, hy + 9, 4, 1, c.skin);
  } else if (dir === 'up') {
    // Back of head - all hair
    rect(ctx, hx + 8, hy + 0, 8, 1, c.hair);
    rect(ctx, hx + 7, hy + 1, 10, 1, c.hair);
    rect(ctx, hx + 6, hy + 2, 12, 2, c.hair);
    rect(ctx, hx + 6, hy + 4, 12, 4, c.hairDark);
    // Neck
    rect(ctx, hx + 10, hy + 8, 4, 1, c.skin);
    rect(ctx, hx + 10, hy + 9, 4, 1, c.skin);
  } else if (dir === 'left') {
    // Left profile
    rect(ctx, hx + 8, hy + 0, 8, 1, c.hair);
    rect(ctx, hx + 6, hy + 1, 10, 1, c.hair);
    rect(ctx, hx + 5, hy + 2, 11, 1, c.hair);
    rect(ctx, hx + 5, hy + 3, 4, 1, c.hair);
    rect(ctx, hx + 9, hy + 3, 7, 5, c.skin);
    rect(ctx, hx + 5, hy + 4, 4, 4, c.hair); // hair falling left
    px(ctx, hx + 10, hy + 5, '#222'); // eye
    px(ctx, hx + 10, hy + 4, '#fff');
    rect(ctx, hx + 9, hy + 7, 1, 1, c.skinDark); // mouth hint
    rect(ctx, hx + 10, hy + 8, 4, 1, c.skin);
    rect(ctx, hx + 10, hy + 9, 4, 1, c.skin);
  } else {
    // Right profile
    rect(ctx, hx + 8, hy + 0, 8, 1, c.hair);
    rect(ctx, hx + 8, hy + 1, 10, 1, c.hair);
    rect(ctx, hx + 8, hy + 2, 11, 1, c.hair);
    rect(ctx, hx + 13, hy + 3, 4, 1, c.hair);
    rect(ctx, hx + 8, hy + 3, 7, 5, c.skin);
    rect(ctx, hx + 15, hy + 4, 4, 4, c.hair); // hair falling right
    px(ctx, hx + 13, hy + 5, '#222'); // eye
    px(ctx, hx + 13, hy + 4, '#fff');
    rect(ctx, hx + 14, hy + 7, 1, 1, c.skinDark); // mouth hint
    rect(ctx, hx + 10, hy + 8, 4, 1, c.skin);
    rect(ctx, hx + 10, hy + 9, 4, 1, c.skin);
  }
}

function drawCharTorso(
  ctx: Ctx, ox: number, oy: number, c: CharacterColors,
  dir: 'down' | 'left' | 'right' | 'up', bobY: number = 0,
  leanForward: boolean = false,
): void {
  const tx = ox;
  const ty = oy + 10 + bobY;
  const leanOff = leanForward ? 1 : 0;

  if (dir === 'down' || dir === 'up') {
    // Front or back torso (10px wide, 8px tall)
    const mainColor = dir === 'down' ? c.clothing : c.clothingDark;
    const detailColor = dir === 'down' ? c.clothingDark : c.clothing;

    // Shoulders (wide)
    rect(ctx, tx + 6, ty + 0, 12, 2, mainColor);
    // Torso body
    rect(ctx, tx + 7, ty + 2, 10, 6, mainColor);
    // Collar/accent
    if (dir === 'down') {
      rect(ctx, tx + 10, ty + 0, 4, 2, c.accent);
      // Buttons/detail line
      px(ctx, tx + 12, ty + 3, detailColor);
      px(ctx, tx + 12, ty + 5, detailColor);
    }
    // 1px outline on sides
    rect(ctx, tx + 6, ty + 0, 1, 2, c.outline);
    rect(ctx, tx + 17, ty + 0, 1, 2, c.outline);
    rect(ctx, tx + 7, ty + 2, 1, 6, c.outline);
    rect(ctx, tx + 16, ty + 2, 1, 6, c.outline);

    // Arms (skin or clothing depending)
    if (!leanForward) {
      // Arms at sides
      rect(ctx, tx + 5 + leanOff, ty + 1, 2, 5, mainColor);
      rect(ctx, tx + 17 - leanOff, ty + 1, 2, 5, mainColor);
      // Hands
      rect(ctx, tx + 5 + leanOff, ty + 6, 2, 2, c.skin);
      rect(ctx, tx + 17 - leanOff, ty + 6, 2, 2, c.skin);
    }
  } else {
    // Side view torso
    const facing = dir === 'left' ? -1 : 1;
    const baseX = dir === 'left' ? tx + 7 : tx + 8;

    rect(ctx, baseX, ty + 0, 9, 2, c.clothing); // shoulders
    rect(ctx, baseX + 1, ty + 2, 7, 6, c.clothing);
    // Accent on front
    if (dir === 'left') {
      rect(ctx, baseX, ty + 0, 2, 2, c.accent);
    } else {
      rect(ctx, baseX + 7, ty + 0, 2, 2, c.accent);
    }
    // Outline
    rect(ctx, baseX, ty + 0, 1, 8, c.outline);
    rect(ctx, baseX + 8, ty + 0, 1, 8, c.outline);

    // Arm
    if (!leanForward) {
      const armX = dir === 'left' ? baseX - 1 : baseX + 9;
      rect(ctx, armX, ty + 1, 2, 5, c.clothing);
      rect(ctx, armX, ty + 6, 2, 2, c.skin);
    }
  }
}

function drawCharLegs(
  ctx: Ctx, ox: number, oy: number, c: CharacterColors,
  dir: 'down' | 'left' | 'right' | 'up',
  walkFrame: number = -1, // -1 = standing
): void {
  const lx = ox;
  const ly = oy + 18;

  // Legs are ~12px tall: pants (8px) + shoes (4px at bottom)
  if (dir === 'down' || dir === 'up') {
    if (walkFrame < 0) {
      // Standing
      // Left leg
      rect(ctx, lx + 8, ly + 0, 3, 8, c.pants);
      rect(ctx, lx + 8, ly + 8, 3, 2, c.pantsDark);
      rect(ctx, lx + 7, ly + 10, 4, 2, c.shoes);

      // Right leg
      rect(ctx, lx + 13, ly + 0, 3, 8, c.pants);
      rect(ctx, lx + 13, ly + 8, 3, 2, c.pantsDark);
      rect(ctx, lx + 13, ly + 10, 4, 2, c.shoes);
    } else {
      // Walking - alternate leg positions
      const leftOff = walkFrame === 0 ? 0 : walkFrame === 1 ? -1 : walkFrame === 2 ? 0 : 1;
      const rightOff = walkFrame === 0 ? 0 : walkFrame === 1 ? 1 : walkFrame === 2 ? 0 : -1;

      // Left leg
      rect(ctx, lx + 8, ly + 0 + leftOff, 3, 8, c.pants);
      rect(ctx, lx + 8, ly + 8 + leftOff, 3, 2, c.pantsDark);
      rect(ctx, lx + 7, ly + 10 + leftOff, 4, 2, c.shoes);

      // Right leg
      rect(ctx, lx + 13, ly + 0 + rightOff, 3, 8, c.pants);
      rect(ctx, lx + 13, ly + 8 + rightOff, 3, 2, c.pantsDark);
      rect(ctx, lx + 13, ly + 10 + rightOff, 4, 2, c.shoes);
    }
  } else {
    // Side view legs
    const baseX = dir === 'left' ? lx + 8 : lx + 9;

    if (walkFrame < 0) {
      // Standing side
      rect(ctx, baseX, ly + 0, 6, 8, c.pants);
      rect(ctx, baseX, ly + 8, 6, 2, c.pantsDark);
      rect(ctx, baseX - 1, ly + 10, 7, 2, c.shoes);
    } else {
      // Walking side - stride effect
      const frontOff = walkFrame === 1 ? -2 : walkFrame === 3 ? 2 : 0;
      const backOff = walkFrame === 1 ? 2 : walkFrame === 3 ? -2 : 0;

      // Front leg
      rect(ctx, baseX, ly + 0 + frontOff, 3, 8, c.pants);
      rect(ctx, baseX, ly + 8 + frontOff, 3, 2, c.pantsDark);
      rect(ctx, baseX - 1, ly + 10 + Math.max(0, frontOff), 4, 2, c.shoes);

      // Back leg
      rect(ctx, baseX + 3, ly + 0 + backOff, 3, 8, c.pantsDark);
      rect(ctx, baseX + 3, ly + 8 + backOff, 3, 2, c.pantsDark);
      rect(ctx, baseX + 3, ly + 10 + Math.max(0, backOff), 4, 2, c.shoes);
    }
  }
}

function drawWorkArms(
  ctx: Ctx, ox: number, oy: number, c: CharacterColors,
  frame: number,
): void {
  // Arms reaching forward (typing). Frame varies arm height.
  const armY = oy + 12;
  const offsets = [0, -1, 1];
  const off = offsets[frame] ?? 0;

  // Left arm reaching forward
  rect(ctx, ox + 4, armY + off, 2, 3, c.clothing);
  rect(ctx, ox + 3, armY + 3 + off, 2, 2, c.skin);

  // Right arm reaching forward
  rect(ctx, ox + 18, armY + off, 2, 3, c.clothing);
  rect(ctx, ox + 19, armY + 3 + off, 2, 2, c.skin);
}

function drawTalkMouth(
  ctx: Ctx, ox: number, oy: number, c: CharacterColors,
  frame: number, bobY: number,
): void {
  // Vary mouth for talk frames
  if (frame === 0) {
    // Mouth open
    rect(ctx, ox + 10, oy + 7 + bobY, 4, 1, '#3a1a1a');
    rect(ctx, ox + 11, oy + 7 + bobY, 2, 1, '#5a2020');
  } else {
    // Mouth wider
    rect(ctx, ox + 10, oy + 7 + bobY, 4, 2, '#3a1a1a');
    rect(ctx, ox + 11, oy + 7 + bobY, 2, 1, '#5a2020');
  }
}

// ── Character-specific appearance tweaks ─────────────────────────────────────

function drawCharacterSpecifics(
  ctx: Ctx, ox: number, oy: number, charId: string, c: CharacterColors,
  dir: 'down' | 'left' | 'right' | 'up', bobY: number = 0,
): void {
  switch (charId) {
    case 'billy':
      // Slightly tousled hair - extra hair pixels on top
      if (dir === 'down' || dir === 'up') {
        px(ctx, ox + 9, oy + bobY - 1, c.hair);
        px(ctx, ox + 13, oy + bobY - 1, c.hair);
        px(ctx, ox + 11, oy + bobY - 1, c.hair);
      }
      break;

    case 'patrik':
      // Neat combed hair - smoother top line, no stray pixels
      if (dir === 'down') {
        rect(ctx, ox + 7, oy + 2 + bobY, 10, 1, c.hair); // neat fringe
      }
      break;

    case 'marcos':
      // Distinguished gray at temples
      if (dir === 'down') {
        px(ctx, ox + 7, oy + 3 + bobY, '#606060');
        px(ctx, ox + 16, oy + 3 + bobY, '#606060');
        px(ctx, ox + 7, oy + 4 + bobY, '#707070');
        px(ctx, ox + 16, oy + 4 + bobY, '#707070');
      }
      break;

    case 'sandra':
      // Ponytail/bun
      if (dir === 'down' || dir === 'left') {
        rect(ctx, ox + 15, oy + 2 + bobY, 3, 4, c.hair);
        rect(ctx, ox + 16, oy + 1 + bobY, 2, 2, c.hair);
      }
      if (dir === 'up') {
        rect(ctx, ox + 10, oy + 3 + bobY, 4, 3, c.hair);
        rect(ctx, ox + 11, oy + 2 + bobY, 2, 2, c.hairDark);
      }
      if (dir === 'right') {
        rect(ctx, ox + 6, oy + 2 + bobY, 3, 4, c.hair);
        rect(ctx, ox + 6, oy + 1 + bobY, 2, 2, c.hair);
      }
      break;

    case 'isaac':
      // Curly/messy hair - extra poofy top
      if (dir === 'down' || dir === 'up') {
        px(ctx, ox + 7, oy + bobY - 1, c.hair);
        px(ctx, ox + 10, oy + bobY - 1, c.hair);
        px(ctx, ox + 14, oy + bobY - 1, c.hair);
        px(ctx, ox + 16, oy + bobY - 1, c.hair);
        px(ctx, ox + 8, oy + bobY, c.hairDark);
        px(ctx, ox + 12, oy + bobY, c.hairDark);
        px(ctx, ox + 15, oy + bobY, c.hairDark);
      }
      break;

    case 'wendy':
      // Dark curly hair
      if (dir === 'down') {
        px(ctx, ox + 6, oy + 5 + bobY, c.hair);
        px(ctx, ox + 17, oy + 5 + bobY, c.hair);
        px(ctx, ox + 6, oy + 6 + bobY, c.hair);
        px(ctx, ox + 17, oy + 6 + bobY, c.hair);
        // Curls extending down sides
        rect(ctx, ox + 5, oy + 3 + bobY, 2, 5, c.hair);
        rect(ctx, ox + 17, oy + 3 + bobY, 2, 5, c.hair);
      }
      if (dir === 'left') {
        rect(ctx, ox + 5, oy + 3 + bobY, 3, 5, c.hair);
      }
      if (dir === 'right') {
        rect(ctx, ox + 16, oy + 3 + bobY, 3, 5, c.hair);
      }
      break;
  }
}

// ── Character Sheet Generation ───────────────────────────────────────────────

type DirType = 'down' | 'left' | 'right' | 'up';
const DIRECTIONS: DirType[] = ['down', 'left', 'right', 'up'];

/**
 * Generates a single character sprite sheet (24x32 per frame).
 * Layout: 10 columns x 4 rows = 240x128 pixels
 * Cols: 0=idle(1), 1-4=walk(4), 5-7=work(3), 8-9=talk(2)
 * Rows: 0=down, 1=left, 2=right, 3=up
 */
function generateCharacterSheet(charId: string): Buffer {
  const cols = 10;
  const rows = 4;
  const canvas = createCanvas(cols * CHAR_W, rows * CHAR_H);
  const ctx = canvas.getContext('2d');

  const c = CHARACTERS[charId]!;

  for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
    const dir = DIRECTIONS[dirIdx]!;
    const rowY = dirIdx * CHAR_H;

    // Col 0: Idle
    {
      const ox = 0;
      drawCharHead(ctx, ox, rowY, c, dir);
      drawCharTorso(ctx, ox, rowY, c, dir);
      drawCharLegs(ctx, ox, rowY, c, dir);
      drawCharacterSpecifics(ctx, ox, rowY, charId, c, dir);
    }

    // Cols 1-4: Walk (4 frames)
    for (let f = 0; f < 4; f++) {
      const ox = (f + 1) * CHAR_W;
      drawCharHead(ctx, ox, rowY, c, dir);
      drawCharTorso(ctx, ox, rowY, c, dir);
      drawCharLegs(ctx, ox, rowY, c, dir, f);
      drawCharacterSpecifics(ctx, ox, rowY, charId, c, dir);
    }

    // Cols 5-7: Work (3 frames) -- slight lean forward, arms reaching
    for (let f = 0; f < 3; f++) {
      const ox = (f + 5) * CHAR_W;
      drawCharHead(ctx, ox, rowY, c, dir);
      drawCharTorso(ctx, ox, rowY, c, dir, 0, true);
      drawCharLegs(ctx, ox, rowY, c, dir);
      drawWorkArms(ctx, ox, rowY, c, f);
      drawCharacterSpecifics(ctx, ox, rowY, charId, c, dir);
    }

    // Cols 8-9: Talk (2 frames) -- head bob + mouth variation
    for (let f = 0; f < 2; f++) {
      const ox = (f + 8) * CHAR_W;
      const bobY = f === 1 ? -1 : 0;
      drawCharHead(ctx, ox, rowY, c, dir, bobY);
      drawCharTorso(ctx, ox, rowY, c, dir, bobY);
      drawCharLegs(ctx, ox, rowY, c, dir);
      drawTalkMouth(ctx, ox, rowY, c, f, bobY);
      drawCharacterSpecifics(ctx, ox, rowY, charId, c, dir, bobY);
    }
  }

  return canvas.toBuffer('image/png');
}

// ── Environment Sheet Generation ─────────────────────────────────────────────

function generateEnvironmentSheet(): Buffer {
  const cols = 16;
  const rows = 12;
  const canvas = createCanvas(cols * TILE, rows * TILE);
  const ctx = canvas.getContext('2d');

  // Helper to fill a tile at (col, row) with solid color
  function fillTile(col: number, row: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
  }

  // Helper to draw a pixel relative to tile origin
  function tilePx(col: number, row: number, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(col * TILE + x, row * TILE + y, 1, 1);
  }

  // Helper for tile-relative rect
  function tileRect(col: number, row: number, x: number, y: number, w: number, h: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(col * TILE + x, row * TILE + y, w, h);
  }

  // ── Row 0: Floor tiles (16x16, 3/4 perspective) ──

  // (0,0) Office floor -- warm parquet wood grain
  fillTile(0, 0, '#c4a66a');
  // Alternating light/dark oak strips at slight angle
  for (let y = 0; y < TILE; y++) {
    const strip = Math.floor((y + 1) / 3) % 2;
    for (let x = 0; x < TILE; x++) {
      const xShift = (x + y) % 6;
      if (strip === 0) {
        if (xShift === 0) tilePx(0, 0, x, y, '#b8975c');
        if (xShift === 3) tilePx(0, 0, x, y, '#d4b87a');
      } else {
        if (xShift === 1) tilePx(0, 0, x, y, '#b8975c');
        if (xShift === 4) tilePx(0, 0, x, y, '#d4b87a');
      }
    }
  }
  // Wood plank dividers
  for (let x = 0; x < TILE; x++) {
    tilePx(0, 0, x, 5, '#b08850');
    tilePx(0, 0, x, 10, '#b08850');
  }

  // (1,0) Hallway floor -- cooler/lighter tile
  fillTile(1, 0, '#b8b0a0');
  for (let y = 0; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x++) {
      tilePx(1, 0, x, y, '#a8a090');
    }
    for (let x = 0; x < TILE; x += 4) {
      for (let dy = 0; dy < 4 && y + dy < TILE; dy++) {
        tilePx(1, 0, x, y + dy, '#a8a090');
      }
    }
  }

  // (2,0) War room floor -- dark rich wood
  fillTile(2, 0, '#8b6e4e');
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const grain = (x * 3 + y * 5) % 7;
      if (grain === 0) tilePx(2, 0, x, y, '#7a5e3e');
      if (grain === 3) tilePx(2, 0, x, y, '#9a7e5e');
    }
  }
  // Plank lines
  for (let x = 0; x < TILE; x++) {
    tilePx(2, 0, x, 4, '#7a5838');
    tilePx(2, 0, x, 9, '#7a5838');
    tilePx(2, 0, x, 14, '#7a5838');
  }

  // (3,0) Door tile -- hallway floor with threshold hint
  fillTile(3, 0, '#b8b0a0');
  // Threshold bar
  tileRect(3, 0, 2, 0, TILE - 4, 2, '#8a7858');
  tileRect(3, 0, 2, TILE - 2, TILE - 4, 2, '#8a7858');
  // Interior same as hallway
  for (let y = 2; y < TILE - 2; y++) {
    for (let x = 0; x < TILE; x++) {
      if ((x + y) % 5 === 0) tilePx(3, 0, x, y, '#a8a090');
    }
  }

  // ── Row 1: Wall tiles ──

  // (0,1) Top wall -- cream with subtle texture
  fillTile(0, 1, '#d4c8a8');
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if ((x * 7 + y * 3) % 11 === 0) tilePx(0, 1, x, y, '#c8bc98');
    }
  }
  // Baseboard at bottom
  tileRect(0, 1, 0, TILE - 2, TILE, 2, '#a09878');

  // (1,1) Side wall -- slightly darker
  fillTile(1, 1, '#c8bc98');
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if ((x * 5 + y * 7) % 13 === 0) tilePx(1, 1, x, y, '#b8ac88');
    }
  }
  tileRect(1, 1, 0, TILE - 2, TILE, 2, '#988868');

  // (2,1) Wall with window
  fillTile(2, 1, '#d4c8a8');
  // Window frame
  tileRect(2, 1, 3, 2, 10, 10, '#8a7858');
  // Glass
  tileRect(2, 1, 4, 3, 8, 8, '#88b8d8');
  tileRect(2, 1, 5, 4, 6, 6, '#a0d0e8');
  // Mullions (window dividers)
  tileRect(2, 1, 7, 3, 2, 8, '#8a7858');
  tileRect(2, 1, 4, 6, 8, 2, '#8a7858');
  // Sky/light reflection
  tileRect(2, 1, 5, 4, 2, 2, '#c8e8f8');

  // ── Row 2: Furniture (16x16, 3/4 perspective with visible front faces) ──

  // (0,2) Desk left half -- dark wood with drawer front
  fillTile(0, 2, '#6b5035');
  // Desk top surface (visible from above)
  tileRect(0, 2, 0, 1, TILE, 6, '#7c5d3e');
  tileRect(0, 2, 1, 2, TILE - 2, 2, '#8a6b48'); // surface highlight
  // Front face (drawer panel)
  tileRect(0, 2, 0, 7, TILE, 8, '#5a4028');
  tileRect(0, 2, 1, 8, TILE - 2, 3, '#4a3018'); // drawer recess
  // Drawer handle
  tileRect(0, 2, 6, 9, 4, 1, '#9a8060');
  // Bottom edge
  tileRect(0, 2, 0, TILE - 1, TILE, 1, '#3a2818');

  // (1,2) Desk right half
  fillTile(1, 2, '#6b5035');
  tileRect(1, 2, 0, 1, TILE, 6, '#7c5d3e');
  tileRect(1, 2, 1, 2, TILE - 2, 2, '#8a6b48');
  tileRect(1, 2, 0, 7, TILE, 8, '#5a4028');
  tileRect(1, 2, 1, 8, TILE - 2, 3, '#4a3018');
  tileRect(1, 2, 6, 9, 4, 1, '#9a8060');
  tileRect(1, 2, 0, TILE - 1, TILE, 1, '#3a2818');

  // (2,2) Chair -- 3/4 view showing seat and backrest curve
  // Clear background
  fillTile(2, 2, 'transparent');
  // Chair back (curved arc)
  tileRect(2, 2, 3, 1, 10, 3, '#5c3d2e');
  tileRect(2, 2, 4, 2, 8, 2, '#7a5040');
  // Seat surface (from above)
  tileRect(2, 2, 4, 4, 8, 5, '#6a4838');
  tileRect(2, 2, 5, 5, 6, 3, '#7a5848'); // seat cushion highlight
  // Chair legs (front face)
  tileRect(2, 2, 4, 9, 2, 5, '#4a2e1e');
  tileRect(2, 2, 10, 9, 2, 5, '#4a2e1e');
  // Wheel base hint
  tileRect(2, 2, 3, 13, 10, 2, '#3a2a1a');

  // (3,2) Bookshelf top -- front face showing book spines
  fillTile(3, 2, '#5c3d2e');
  // Shelf frame
  tileRect(3, 2, 0, 0, TILE, TILE, '#4a3020');
  // Top shelf
  tileRect(3, 2, 1, 1, TILE - 2, 1, '#5c3d2e');
  // Book spines -- various colors
  const bookColors = ['#c04040', '#4040c0', '#40a040', '#c0a040', '#8040a0', '#40a0a0'];
  for (let i = 0; i < 6; i++) {
    tileRect(3, 2, 1 + i * 2, 2, 2, 5, bookColors[i]!);
    // Title band
    tileRect(3, 2, 1 + i * 2, 3, 2, 1, '#d0c0b0');
  }
  // Middle shelf
  tileRect(3, 2, 1, 7, TILE - 2, 1, '#5c3d2e');
  // More books
  for (let i = 0; i < 5; i++) {
    tileRect(3, 2, 1 + i * 3, 8, 2, 6, bookColors[(i + 2) % 6]!);
  }
  // Bottom shelf line
  tileRect(3, 2, 1, 14, TILE - 2, 1, '#5c3d2e');

  // (4,2) Bookshelf bottom
  fillTile(4, 2, '#5c3d2e');
  tileRect(4, 2, 0, 0, TILE, TILE, '#4a3020');
  for (let i = 0; i < 6; i++) {
    tileRect(4, 2, 1 + i * 2, 1, 2, 6, bookColors[(i + 1) % 6]!);
    tileRect(4, 2, 1 + i * 2, 2, 2, 1, '#d0c0b0');
  }
  tileRect(4, 2, 1, 7, TILE - 2, 1, '#5c3d2e');
  for (let i = 0; i < 5; i++) {
    tileRect(4, 2, 1 + i * 3, 8, 2, 6, bookColors[(i + 3) % 6]!);
  }
  tileRect(4, 2, 1, 14, TILE - 2, 1, '#5c3d2e');

  // (5,2) Conference table segment -- dark premium wood
  fillTile(5, 2, '#4a3728');
  // Table top surface (from above)
  tileRect(5, 2, 0, 1, TILE, 7, '#5c4538');
  tileRect(5, 2, 1, 2, TILE - 2, 3, '#6a5040'); // surface highlight
  // Front face
  tileRect(5, 2, 0, 8, TILE, 7, '#3a2818');
  tileRect(5, 2, 1, 9, TILE - 2, 4, '#4a3020');
  // Bottom edge
  tileRect(5, 2, 0, TILE - 1, TILE, 1, '#2a1808');

  // (6,2) Monitor -- screen facing south toward viewer
  fillTile(6, 2, 'transparent');
  // Screen bezel
  tileRect(6, 2, 2, 1, 12, 9, '#303030');
  // Screen
  tileRect(6, 2, 3, 2, 10, 7, '#1a2a3a');
  // Content on screen (colored pixels)
  tileRect(6, 2, 4, 3, 5, 1, '#33cc66');
  tileRect(6, 2, 4, 5, 7, 1, '#4488cc');
  tileRect(6, 2, 4, 7, 3, 1, '#cc4444');
  tileRect(6, 2, 8, 7, 4, 1, '#33cc66');
  // Stand
  tileRect(6, 2, 6, 10, 4, 3, '#404040');
  tileRect(6, 2, 4, 13, 8, 2, '#505050');

  // (7,2) Couch -- soft upholstered, earth tones, 3/4 view
  fillTile(7, 2, 'transparent');
  // Back rest (from above, foreshortened)
  tileRect(7, 2, 1, 1, 14, 4, '#7a6050');
  tileRect(7, 2, 2, 2, 12, 2, '#8a7060'); // fabric highlight
  // Seat cushion
  tileRect(7, 2, 1, 5, 14, 5, '#9a8068');
  tileRect(7, 2, 2, 6, 5, 3, '#a89078'); // left cushion highlight
  tileRect(7, 2, 9, 6, 5, 3, '#a89078'); // right cushion highlight
  // Front face
  tileRect(7, 2, 1, 10, 14, 4, '#6a5040');
  // Armrests
  tileRect(7, 2, 0, 3, 2, 8, '#7a6050');
  tileRect(7, 2, 14, 3, 2, 8, '#7a6050');
  // Feet
  tileRect(7, 2, 2, 14, 2, 2, '#4a3020');
  tileRect(7, 2, 12, 14, 2, 2, '#4a3020');

  // ── Row 3: Decorations ──

  // (0,3) Plant -- detailed potted plant with leaf fronds, 3/4 view
  fillTile(0, 3, 'transparent');
  // Pot (3/4 view with rim and front)
  tileRect(0, 3, 4, 10, 8, 5, '#8b5c38');
  tileRect(0, 3, 3, 10, 10, 2, '#9a6c48'); // rim
  tileRect(0, 3, 5, 12, 6, 3, '#7a4c28'); // pot front shadow
  // Leaves (from above-and-front)
  const leafGreen = '#2d8b4e';
  const leafDark = '#1a6b3a';
  // Frond clusters
  tileRect(0, 3, 5, 3, 4, 3, leafGreen);
  tileRect(0, 3, 3, 5, 3, 3, leafGreen);
  tileRect(0, 3, 9, 4, 4, 3, leafGreen);
  tileRect(0, 3, 6, 6, 4, 4, leafDark);
  tileRect(0, 3, 2, 7, 3, 2, leafGreen);
  tileRect(0, 3, 11, 6, 3, 3, leafGreen);
  // Leaf tips
  tilePx(0, 3, 4, 2, leafGreen);
  tilePx(0, 3, 10, 3, leafGreen);
  tilePx(0, 3, 1, 6, leafDark);
  tilePx(0, 3, 13, 5, leafDark);
  // Stem hint
  tileRect(0, 3, 7, 8, 2, 2, '#3a6030');

  // (1,3) Water cooler -- blue jug on stand, 3/4 view
  fillTile(1, 3, 'transparent');
  // Jug (top)
  tileRect(1, 3, 5, 1, 6, 5, '#a0c8e0');
  tileRect(1, 3, 6, 2, 4, 3, '#c8e0f0'); // water highlight
  // Spout
  tileRect(1, 3, 6, 6, 4, 2, '#8ca0b0');
  // Body (stand)
  tileRect(1, 3, 4, 6, 8, 8, '#90a0b0');
  tileRect(1, 3, 5, 7, 6, 6, '#a0b0c0'); // front panel
  // Drip tray
  tileRect(1, 3, 5, 8, 6, 1, '#708090');
  // Base
  tileRect(1, 3, 4, 14, 8, 2, '#607080');

  // (2,3) Artwork frame
  fillTile(2, 3, 'transparent');
  // Frame
  tileRect(2, 3, 2, 1, 12, 12, '#8b7355');
  tileRect(2, 3, 3, 2, 10, 10, '#705830');
  // Canvas content
  tileRect(2, 3, 4, 3, 8, 8, '#4a6a8a');
  tileRect(2, 3, 5, 5, 6, 4, '#6a8aaa');
  // Abstract brush strokes
  tileRect(2, 3, 6, 4, 3, 2, '#8aaa6a');
  tilePx(2, 3, 10, 4, '#c0a040');

  // (3,3) Whiteboard
  fillTile(3, 3, 'transparent');
  tileRect(3, 3, 1, 1, 14, 13, '#a0a0a0');
  tileRect(3, 3, 2, 2, 12, 11, '#f0f0f0');
  // Scribbles
  tileRect(3, 3, 3, 4, 8, 1, '#333');
  tileRect(3, 3, 4, 6, 6, 1, '#333');
  tileRect(3, 3, 3, 8, 5, 1, '#d44');
  tileRect(3, 3, 5, 10, 7, 1, '#2266aa');

  // (4,3) Post-it cluster
  fillTile(4, 3, 'transparent');
  tileRect(4, 3, 1, 1, 5, 5, '#fff44f');
  tileRect(4, 3, 5, 3, 5, 5, '#ff9966');
  tileRect(4, 3, 3, 7, 5, 5, '#77dd77');
  tileRect(4, 3, 8, 1, 5, 5, '#aec6cf');
  tileRect(4, 3, 9, 7, 5, 5, '#ff6961');

  // (5,3) Filing cabinet
  fillTile(5, 3, 'transparent');
  tileRect(5, 3, 3, 0, 10, 15, '#707880');
  tileRect(5, 3, 4, 1, 8, 4, '#808890');
  tileRect(5, 3, 4, 6, 8, 4, '#808890');
  tileRect(5, 3, 4, 11, 8, 3, '#808890');
  // Handles
  tileRect(5, 3, 7, 2, 2, 1, '#b0b8c0');
  tileRect(5, 3, 7, 7, 2, 1, '#b0b8c0');
  tileRect(5, 3, 7, 12, 2, 1, '#b0b8c0');

  // (6,3) Monitor (decoration version -- generic)
  fillTile(6, 3, 'transparent');
  tileRect(6, 3, 3, 1, 10, 8, '#303030');
  tileRect(6, 3, 4, 2, 8, 6, '#1a3a2a');
  tileRect(6, 3, 5, 3, 3, 1, '#33cc66');
  tileRect(6, 3, 5, 5, 5, 1, '#33cc66');
  tileRect(6, 3, 6, 9, 4, 3, '#505050');
  tileRect(6, 3, 5, 12, 6, 1, '#505050');

  // ── Row 4: Agent personality items ──

  // (0,4) Patrik chart -- financial bar chart on wall
  fillTile(0, 4, 'transparent');
  tileRect(0, 4, 1, 1, 14, 13, '#f0f0f0');
  tileRect(0, 4, 2, 12, 12, 1, '#333');
  tileRect(0, 4, 2, 3, 1, 9, '#333');
  // Bars
  tileRect(0, 4, 4, 8, 2, 4, '#4488cc');
  tileRect(0, 4, 7, 5, 2, 7, '#4488cc');
  tileRect(0, 4, 10, 6, 2, 6, '#33aa66');
  tileRect(0, 4, 13, 9, 2, 3, '#cc4444');

  // (1,4) Marcos law books -- stack of thick law books
  fillTile(1, 4, 'transparent');
  tileRect(1, 4, 2, 3, 12, 11, '#3a2820');
  const lawColors = ['#1a2a4a', '#2a1a1a', '#1a3a2a', '#3a2a1a'];
  for (let i = 0; i < 4; i++) {
    tileRect(1, 4, 3 + i * 3, 1, 2, 12, lawColors[i]!);
    tileRect(1, 4, 3 + i * 3, 2, 2, 1, '#c0b0a0');
  }

  // (2,4) Sandra schedule -- production schedule board
  fillTile(2, 4, 'transparent');
  tileRect(2, 4, 0, 0, TILE, TILE, '#b0b0b0');
  tileRect(2, 4, 1, 1, TILE - 2, TILE - 2, '#f8f8f8');
  // Gantt chart lines
  tileRect(2, 4, 2, 3, 10, 1, '#2266aa');
  tileRect(2, 4, 3, 5, 8, 1, '#22aa44');
  tileRect(2, 4, 2, 7, 6, 1, '#cc3333');
  tileRect(2, 4, 4, 9, 7, 1, '#ff8800');
  tileRect(2, 4, 2, 11, 9, 1, '#8844cc');

  // (3,4) Isaac scripts -- script stacks
  fillTile(3, 4, 'transparent');
  // Stack of scripts/papers
  tileRect(3, 4, 2, 6, 10, 8, '#e8e0d0');
  tileRect(3, 4, 3, 4, 9, 8, '#f0e8d8');
  tileRect(3, 4, 4, 2, 8, 8, '#f8f0e0');
  // Text lines
  tileRect(3, 4, 5, 3, 6, 1, '#666');
  tileRect(3, 4, 5, 5, 4, 1, '#888');
  tileRect(3, 4, 5, 7, 5, 1, '#666');
  // Folded corner
  tileRect(3, 4, 10, 2, 2, 2, '#e0d8c8');

  // ── Row 5: More personality items ──

  // (0,5) Isaac corkboard -- corkboard with pinned notes
  fillTile(0, 5, 'transparent');
  tileRect(0, 5, 1, 1, 14, 14, '#c4956a');
  // Cork texture
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if ((x * 5 + y * 3) % 7 === 0 && x > 0 && x < 15 && y > 0 && y < 15) {
        tilePx(0, 5, x, y, '#b48558');
      }
    }
  }
  // Pinned notes
  tileRect(0, 5, 2, 2, 4, 4, '#fff44f');
  tileRect(0, 5, 8, 3, 5, 4, '#aec6cf');
  tileRect(0, 5, 3, 8, 4, 5, '#ff9966');
  tileRect(0, 5, 9, 9, 4, 4, '#77dd77');
  // Pins
  tilePx(0, 5, 4, 2, '#cc3333');
  tilePx(0, 5, 10, 3, '#cc3333');
  tilePx(0, 5, 5, 8, '#cc3333');
  tilePx(0, 5, 11, 9, '#cc3333');

  // (1,5) Patrik monitor -- monitor showing financial numbers
  fillTile(1, 5, 'transparent');
  tileRect(1, 5, 2, 1, 12, 9, '#2a2a2a');
  tileRect(1, 5, 3, 2, 10, 7, '#0a1a0a');
  tileRect(1, 5, 4, 3, 4, 1, '#33ff66');
  tileRect(1, 5, 4, 5, 6, 1, '#33ff66');
  tileRect(1, 5, 4, 7, 3, 1, '#33ff66');
  tileRect(1, 5, 9, 3, 3, 1, '#ff4444');
  tileRect(1, 5, 6, 10, 4, 3, '#404040');
  tileRect(1, 5, 5, 13, 6, 1, '#404040');

  // (2,5) Wendy cushion -- comfort cushion near couch
  fillTile(2, 5, 'transparent');
  // Soft cushion shape
  tileRect(2, 5, 3, 4, 10, 8, '#d4889a');
  tileRect(2, 5, 4, 3, 8, 10, '#d4889a');
  // Highlight
  tileRect(2, 5, 5, 5, 6, 4, '#e0a0b0');
  // Border detail
  tileRect(2, 5, 4, 4, 8, 1, '#c07888');
  tileRect(2, 5, 4, 11, 8, 1, '#c07888');

  // (3,5) Wendy motivational -- framed motivational piece
  fillTile(3, 5, 'transparent');
  tileRect(3, 5, 1, 1, 14, 13, '#d4a878');
  tileRect(3, 5, 2, 2, 12, 11, '#f8f0e8');
  // Motivational text lines
  tileRect(3, 5, 4, 4, 8, 1, '#ec4899');
  tileRect(3, 5, 5, 6, 6, 1, '#666');
  tileRect(3, 5, 4, 8, 8, 1, '#666');
  tileRect(3, 5, 6, 10, 4, 1, '#ec4899');

  // ── Row 6: Personal touch items ──

  // (0,6) Coffee mug -- small brown/white cylinder
  fillTile(0, 6, 'transparent');
  tileRect(0, 6, 5, 4, 6, 7, '#8b6040');   // mug body
  tileRect(0, 6, 6, 5, 4, 5, '#f0e8d8');   // inner/highlight
  tileRect(0, 6, 11, 6, 2, 4, '#8b6040');  // handle
  tileRect(0, 6, 12, 7, 1, 2, '#8b6040');  // handle outer
  tileRect(0, 6, 5, 3, 6, 1, '#705030');   // rim
  // Coffee inside
  tileRect(0, 6, 6, 4, 4, 2, '#4a2810');

  // (1,6) Pen holder -- dark rectangle with colored pencil tips
  fillTile(1, 6, 'transparent');
  tileRect(1, 6, 5, 6, 6, 8, '#3a3a40');   // holder body
  tileRect(1, 6, 6, 7, 4, 6, '#4a4a50');   // front highlight
  // Pencil tips sticking up
  tileRect(1, 6, 6, 2, 1, 5, '#e8d040');   // yellow pencil
  tileRect(1, 6, 8, 3, 1, 4, '#4488cc');   // blue pencil
  tileRect(1, 6, 10, 1, 1, 6, '#cc4444');  // red pencil
  tilePx(1, 6, 6, 2, '#333');               // pencil tip
  tilePx(1, 6, 8, 3, '#333');
  tilePx(1, 6, 10, 1, '#333');

  // (2,6) Calculator -- gray rectangle with grid of tiny dots
  fillTile(2, 6, 'transparent');
  tileRect(2, 6, 3, 3, 10, 11, '#808890');  // body
  tileRect(2, 6, 4, 4, 8, 3, '#1a2a1a');   // screen
  tileRect(2, 6, 5, 5, 4, 1, '#33cc66');   // numbers on screen
  // Button grid (3x4)
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 3; bx++) {
      tileRect(2, 6, 5 + bx * 2, 8 + by * 1.5 | 0, 1, 1, '#c0c0c0');
    }
  }

  // (3,6) Photo frame -- small brown rectangle with lighter inner area
  fillTile(3, 6, 'transparent');
  tileRect(3, 6, 3, 3, 10, 10, '#8b7355');  // frame outer
  tileRect(3, 6, 4, 4, 8, 8, '#705830');    // frame inner
  tileRect(3, 6, 5, 5, 6, 6, '#d4c8b0');    // photo area
  tileRect(3, 6, 6, 6, 4, 3, '#c0a080');    // face hint (warm tone)
  tileRect(3, 6, 7, 7, 2, 1, '#a08060');    // darker detail

  // (4,6) Desk plant -- tiny green pot plant (2-3 leaves)
  fillTile(4, 6, 'transparent');
  // Tiny pot
  tileRect(4, 6, 6, 10, 4, 4, '#8b5c38');
  tileRect(4, 6, 5, 10, 6, 1, '#9a6c48');   // rim
  // Leaves
  tileRect(4, 6, 7, 6, 2, 4, '#2a7a40');    // stem
  tileRect(4, 6, 5, 4, 3, 3, '#3a9a50');    // left leaf
  tileRect(4, 6, 9, 3, 3, 3, '#3a9a50');    // right leaf
  tileRect(4, 6, 7, 2, 2, 3, '#2d8b4e');    // top leaf
  tilePx(4, 6, 6, 4, '#1a6b3a');            // leaf shadow
  tilePx(4, 6, 10, 3, '#1a6b3a');

  // (5,6) Figurine -- small colorful standing figure
  fillTile(5, 6, 'transparent');
  // Head
  tileRect(5, 6, 7, 3, 2, 2, '#c8a070');
  // Body
  tileRect(5, 6, 6, 5, 4, 4, '#cc4444');
  tileRect(5, 6, 7, 6, 2, 2, '#dd6666');    // highlight
  // Legs
  tileRect(5, 6, 6, 9, 2, 3, '#3a3a48');
  tileRect(5, 6, 8, 9, 2, 3, '#3a3a48');
  // Base
  tileRect(5, 6, 5, 12, 6, 2, '#505050');

  // (6,6) Candle -- small cream cylinder with orange dot
  fillTile(6, 6, 'transparent');
  // Candle body
  tileRect(6, 6, 6, 6, 4, 8, '#f0e8d0');
  tileRect(6, 6, 7, 7, 2, 6, '#e8dcc0');    // shadow
  // Rim/holder
  tileRect(6, 6, 5, 13, 6, 2, '#a09080');
  // Wick
  tileRect(6, 6, 7, 4, 2, 2, '#333');
  // Flame
  tilePx(6, 6, 7, 3, '#ff8800');
  tilePx(6, 6, 8, 3, '#ffaa00');
  tilePx(6, 6, 8, 2, '#ffcc44');

  // (7,6) Papers -- scattered white rectangles with gray line suggestions
  fillTile(7, 6, 'transparent');
  // Bottom paper (rotated slightly via offset)
  tileRect(7, 6, 2, 5, 10, 9, '#e8e0d0');
  // Top paper
  tileRect(7, 6, 4, 3, 9, 10, '#f4f0e8');
  // Text lines on top paper
  tileRect(7, 6, 5, 5, 7, 1, '#999');
  tileRect(7, 6, 5, 7, 5, 1, '#999');
  tileRect(7, 6, 5, 9, 6, 1, '#aaa');
  tileRect(7, 6, 5, 11, 4, 1, '#aaa');
  // Folded corner
  tileRect(7, 6, 11, 3, 2, 2, '#ddd8c8');

  // (8,6) Water glass -- clear/light blue small cylinder
  fillTile(8, 6, 'transparent');
  // Glass body (semi-transparent look)
  tileRect(8, 6, 6, 4, 4, 9, '#c0d8e8');
  tileRect(8, 6, 7, 5, 2, 7, '#d8e8f0');    // highlight
  // Rim
  tileRect(8, 6, 5, 3, 6, 1, '#a0b8c8');
  tileRect(8, 6, 6, 4, 4, 1, '#b0c8d8');
  // Water level inside
  tileRect(8, 6, 7, 6, 2, 5, '#88b0d0');
  // Base
  tileRect(8, 6, 6, 13, 4, 1, '#90a8b8');

  return canvas.toBuffer('image/png');
}

// ── Main Generation ──────────────────────────────────────────────────────────

function main(): void {
  console.log('Generating sprite sheets (24x32 characters, 16x16 environment)...');

  // Generate individual character sheets (24x32 per frame, 240x128 per sheet)
  for (const charId of Object.keys(CHARACTERS)) {
    const buffer = generateCharacterSheet(charId);
    const path = resolve(SPRITE_DIR, `${charId}.png`);
    writeFileSync(path, buffer);
    console.log(`  Created: ${path} (${buffer.length} bytes, 240x128)`);
  }

  // Generate environment sheet (16x16 per tile, 256x192)
  const envBuffer = generateEnvironmentSheet();
  const envPath = resolve(SPRITE_DIR, 'environment.png');
  writeFileSync(envPath, envBuffer);
  console.log(`  Created: ${envPath} (${envBuffer.length} bytes, 256x192)`);

  console.log('Done! All sprite sheets generated.');
}

main();
