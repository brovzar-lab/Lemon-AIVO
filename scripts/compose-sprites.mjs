/**
 * Metro City Sprite Compositor
 *
 * Composites body (Character Model) + outfit + hair into pre-baked per-agent
 * character sheets. Each agent gets a unique combination.
 *
 * Metro City Character Model layout (768×192 = 24 cols × 6 rows of 32×32):
 *   Rows 0-2: Light skin (3 walk-cycle rows, each 24 frames)
 *   Rows 3-5: Dark skin (same layout)
 *   Each row: 6 frames × 4 directions (down, left, right, up) = 24 frames
 *
 * Outfit sheets (768×32): 1 row of 24 frames matching body frame positions
 * Hair sheets (32×32 each): Single frame overlaid on every body frame
 * Suit sheet (768×128): 4 rows × 24 cols, rows 0-1 = blue suit, rows 2-3 = red suit
 *
 * Output: public/sprites/metro/<agent>.png (same dimensions as source body sheet)
 *
 * Usage: node scripts/compose-sprites.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const FRAME_W = 32;
const FRAME_H = 32;
const COLS = 24;

// Source paths
const METRO_SRC = '/tmp/metro-sprites/MetroCity';
const METRO2_SRC = '/tmp/metro-sprites-2/MetroCity 2.0';
const OUTPUT_DIR = path.resolve('public/sprites/metro');

// Agent configurations
// skin: 'light' uses rows 0-2, 'dark' uses rows 3-5
// outfit: filename in Outfits/ folder OR 'suit-blue'/'suit-red' for Suit.png
// hair: filename in Hair/ folder
const AGENTS = {
  billy:   { skin: 'light', outfit: 'suit-blue', hair: 'Hair1.png' },
  patrik:  { skin: 'light', outfit: 'Outfit1.png', hair: 'Hair.png' },
  marcos:  { skin: 'dark',  outfit: 'Outfit2.png', hair: 'Hair7.png' },
  sandra:  { skin: 'light', outfit: 'Outfit3.png', hair: 'Hair3.png' },
  isaac:   { skin: 'dark',  outfit: 'Outfit5.png', hair: 'Hair5.png' },
  wendy:   { skin: 'light', outfit: 'Outfit6.png', hair: 'Hair4.png' },
  charlie: { skin: 'dark',  outfit: 'Outfit4.png', hair: 'Hair6.png' },
};

/**
 * Extract the 3 body rows for a given skin tone from the Character Model sheet.
 * Returns a sharp image of 768×96 (24 cols × 3 rows).
 */
async function extractBodyRows(skinType) {
  const bodyPath = path.join(METRO_SRC, 'CharacterModel', 'Character Model.png');
  const bodyMeta = await sharp(bodyPath).metadata();
  const startRow = skinType === 'light' ? 0 : 3;
  const y = startRow * FRAME_H;
  const h = 3 * FRAME_H; // 3 rows

  return sharp(bodyPath)
    .extract({ left: 0, top: y, width: bodyMeta.width, height: h })
    .toBuffer();
}

/**
 * Load an outfit overlay. Returns a buffer that will be composited over the body.
 * Regular outfits: 768×32 (1 row). Suits: 768×64 (2 rows from Suit.png).
 */
async function loadOutfit(outfitName) {
  if (outfitName.startsWith('suit-')) {
    const suitPath = path.join(METRO2_SRC, 'Suit.png');
    const suitMeta = await sharp(suitPath).metadata();
    // suit-blue = rows 0-1, suit-red = rows 2-3
    const startRow = outfitName === 'suit-blue' ? 0 : 2;
    const y = startRow * FRAME_H;
    return {
      buffer: await sharp(suitPath)
        .extract({ left: 0, top: y, width: suitMeta.width, height: 2 * FRAME_H })
        .toBuffer(),
      rows: 2,
    };
  }

  const outfitPath = path.join(METRO_SRC, 'Outfits', outfitName);
  return {
    buffer: await sharp(outfitPath).toBuffer(),
    rows: 1,
  };
}

/**
 * Create a repeated hair overlay across all frames in a row.
 * Hair is a single 32×32 image that gets composited at the top of each frame.
 * Returns a 768×32 buffer with hair tiled across all 24 columns.
 */
async function createHairRow(hairName) {
  const hairPath = path.join(METRO_SRC, 'Hair', hairName);
  const hairBuf = await sharp(hairPath).toBuffer();

  // Create a row of 24 copies of the hair at proper positions
  const composites = [];
  for (let col = 0; col < COLS; col++) {
    composites.push({
      input: hairBuf,
      left: col * FRAME_W,
      top: 0,
    });
  }

  return sharp({
    create: {
      width: COLS * FRAME_W,
      height: FRAME_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Compose a full character sheet for one agent.
 * Output: 768×96 (3 rows of walk animation with composited outfit + hair).
 */
async function composeAgent(agentId, config) {
  console.log(`  Composing ${agentId}...`);

  // 1. Extract body rows (3 rows for the skin type)
  const bodyBuffer = await extractBodyRows(config.skin);
  const bodyW = COLS * FRAME_W; // 768
  const bodyH = 3 * FRAME_H;   // 96

  // 2. Load outfit
  const outfit = await loadOutfit(config.outfit);

  // 3. Create hair row
  const hairRow = await createHairRow(config.hair);

  // 4. Build composites array
  const composites = [];

  // Overlay outfit on each body row
  for (let row = 0; row < 3; row++) {
    if (outfit.rows === 1) {
      // Single-row outfit: repeat on all 3 body rows
      composites.push({
        input: outfit.buffer,
        left: 0,
        top: row * FRAME_H,
      });
    } else {
      // Multi-row outfit (suit): use row 0 of suit for body row 0, row 1 for body rows 1-2
      const suitRow = Math.min(row, outfit.rows - 1);
      const suitRowBuf = await sharp(outfit.buffer)
        .extract({ left: 0, top: suitRow * FRAME_H, width: bodyW, height: FRAME_H })
        .toBuffer();
      composites.push({
        input: suitRowBuf,
        left: 0,
        top: row * FRAME_H,
      });
    }

    // Overlay hair on each body row
    composites.push({
      input: hairRow,
      left: 0,
      top: row * FRAME_H,
    });
  }

  // 5. Composite everything over the body
  const result = await sharp(bodyBuffer, { raw: undefined })
    .composite(composites)
    .png()
    .toBuffer();

  // 6. Write output
  const outputPath = path.join(OUTPUT_DIR, `${agentId}.png`);
  await sharp(result).toFile(outputPath);

  const meta = await sharp(outputPath).metadata();
  console.log(`    ✓ ${outputPath} (${meta.width}×${meta.height})`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Metro City Sprite Compositor');
  console.log('===========================\n');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Compose each agent
  for (const [agentId, config] of Object.entries(AGENTS)) {
    await composeAgent(agentId, config);
  }

  console.log('\n✅ All agents composed successfully!');
  console.log(`   Output: ${OUTPUT_DIR}/`);
}

main().catch((err) => {
  console.error('❌ Composition failed:', err);
  process.exit(1);
});
