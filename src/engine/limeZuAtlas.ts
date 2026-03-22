/**
 * LimeZu Modern Interiors multi-sheet atlas registry.
 *
 * Maps semantic asset keys to { sheetId, frame } tuples.
 * Sheet IDs reference paths in SHEET_PATHS, loaded at startup by spriteSheet.ts.
 *
 * All environment/furniture coordinates use 16x16 tile grid positions.
 *
 * COORDINATE NOTES (verified via pixel sampling):
 * - Floor sheet style 0 (rows 0-2) is transparent in most bands. Use style 1+ (rows 3+).
 * - Floor center tiles are at col=(band*3+1), row=(style*3+1) within each 3-row group.
 * - Flat wall tiles (Room_Builder_Walls_16x16.png) are used for interior walls.
 * - Generic furniture items: many rows 0-3 positions are transparent (header items).
 *   Solid furniture items start around rows 4-8+.
 */
import type { SpriteFrame } from './types';
import { TILE_SIZE } from './types';
import { FURNITURE_48_ATLAS_ENTRIES, FURNITURE_48_SHEET_PATHS, FURNITURE_COMPILED_SHEET_PATHS } from './furniture48Catalog';

const T = TILE_SIZE; // 16

// ── Sheet Paths ──────────────────────────────────────────────────────────────

/**
 * Maps sheet IDs to paths under /sprites/modern-interiors-paid/ for eagerly loaded sheets.
 * 48×48 Singles sheets are NOT listed here — they are lazy-loaded on demand by spriteSheet.ts.
 */
export const SHEET_PATHS: Record<string, string> = {
  'generic': '/sprites/modern-interiors-paid/1_Interiors/16x16/Theme_Sorter/1_Generic_16x16.png',
  'living-room': '/sprites/modern-interiors-paid/1_Interiors/16x16/Theme_Sorter/2_LivingRoom_16x16.png',
  'classroom': '/sprites/modern-interiors-paid/1_Interiors/16x16/Theme_Sorter/5_Classroom_and_library_16x16.png',
  'conference': '/sprites/modern-interiors-paid/1_Interiors/16x16/Theme_Sorter/13_Conference_Hall_16x16.png',
  'film-studio': '/sprites/modern-interiors-paid/1_Interiors/16x16/Theme_Sorter/23_Television_and_Film_Studio.png',
  'floors': '/sprites/modern-interiors-paid/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
  'walls': '/sprites/modern-interiors-paid/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png',
  '3d-walls': '/sprites/modern-interiors-paid/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_3d_walls_16x16.png',
  'baseboards': '/sprites/modern-interiors-paid/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Baseboards_16x16.png',
  'floor-shadows': '/sprites/modern-interiors-paid/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floor_Shadows_16x16.png',
  'ui': '/sprites/modern-interiors-paid/4_User_Interface_Elements/UI_16x16.png',
  'ui-emotes': '/sprites/modern-interiors-paid/4_User_Interface_Elements/UI_thinking_emotes_animation_16x16.png',
  // 48×48 theme sheets (3× resolution, same grid layout as 16×16 equivalents)
  'generic-48':      '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48/1_Generic_48x48.png',
  'living-room-48':  '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48/2_LivingRoom_48x48.png',
  'conference-48':   '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48/13_Conference_Hall_48x48.png',
  'classroom-48':    '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48/5_Classroom_and_library_48x48.png',
  'film-studio-48':  '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48/23_Television_and_Film_Studio_48x48.png',
  // MetroCity character sprites (32x32 frames)
  'metro-char': '/sprites/metro-city/MetroCity/CharacterModel/Character Model.png',
  'metro-hairs': '/sprites/metro-city/MetroCity/Hair/Hairs.png',
  'metro-outfit1': '/sprites/metro-city/MetroCity/Outfits/Outfit1.png',
  'metro-outfit2': '/sprites/metro-city/MetroCity/Outfits/Outfit2.png',
  'metro-outfit3': '/sprites/metro-city/MetroCity/Outfits/Outfit3.png',
  'metro-outfit4': '/sprites/metro-city/MetroCity/Outfits/Outfit4.png',
  'metro-outfit5': '/sprites/metro-city/MetroCity/Outfits/Outfit5.png',
  'metro-outfit6': '/sprites/metro-city/MetroCity/Outfits/Outfit6.png',
  'metro-suit': '/sprites/metro-city/MetroCity/Outfits/Suit.png',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface SheetFrame {
  sheetId: string;
  frame: SpriteFrame;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a SheetFrame from grid coordinates.
 * @param sheetId - Key in SHEET_PATHS
 * @param col - Column index (0-based)
 * @param row - Row index (0-based)
 * @param w - Width in tiles (default 1)
 * @param h - Height in tiles (default 1)
 */
export function sf(sheetId: string, col: number, row: number, w = 1, h = 1): SheetFrame {
  return {
    sheetId,
    frame: { x: col * T, y: row * T, w: w * T, h: h * T },
  };
}

/**
 * Create a SheetFrame for an individual PNG file (full-image mode).
 * frame.w = 0 and frame.h = 0 are sentinels — the renderer reads
 * sheet.naturalWidth / naturalHeight at draw time instead.
 * The sheetId is also the key in FURNITURE_48_SHEET_PATHS.
 */
export function sfFull(sheetId: string): SheetFrame {
  return { sheetId, frame: { x: 0, y: 0, w: 0, h: 0 } };
}

/** Sheet paths for lazily-loaded 48×48 Singles (one PNG per sheetId). */
export { FURNITURE_48_SHEET_PATHS };

/** Sheet paths for compiled 48×48 theme sheets (eagerly loaded at startup). */
export { FURNITURE_COMPILED_SHEET_PATHS };

// ── LimeZu Atlas ─────────────────────────────────────────────────────────────
//
// Floor sheet: 240x640 (15 cols x 40 rows)
//   5 bands of 3 cols each. Style 0 (rows 0-2) is transparent/low-alpha.
//   Valid center tiles start at style 1 (row 4), style 2 (row 7), etc.
//
// Flat walls sheet: 512x640 (32 cols x 40 rows)
//   Used for interior walls. Band 0 col 0 row 0 = light grey (230,230,240).
//
// Generic sheet: 256x1248 (16 cols x 78 rows)
//   Furniture/decoration items. Many top-area tiles are transparent.
//   Best desk items around rows 5, 16, 29-30.

const T48 = 48; // cell size in 48×48 tier sheets

/**
 * Create a SheetFrame for the 48×48 tier — same col/row layout as sf() but at 48px/cell.
 * The 48×48 sheets are exactly 3× the resolution of their 16×16 counterparts.
 * Sheet IDs: 'generic-48', 'living-room-48', 'conference-48', 'classroom-48', 'film-studio-48'
 */
function sf48(sheetId: string, col: number, row: number, w = 1, h = 1): SheetFrame {
  return {
    sheetId,
    frame: { x: col * T48, y: row * T48, w: w * T48, h: h * T48 },
  };
}

export const LIMEZU_ATLAS: Record<string, SheetFrame> = {
  // 48×48 Singles — 5296 individual furniture PNGs (lazy-loaded, full-image mode)
  ...FURNITURE_48_ATLAS_ENTRIES,
  // ── Floors (Room_Builder_Floors_16x16.png, 15 cols × 40 rows) ──────────────
  // 5 bands of 3 cols each. Center tile of each 3×3 block = fill tile.
  // Band centers at cols 1, 4, 7, 10, 13. Styles every 3 rows.
  // Existing selections
  'floor-office': sf('floors', 9, 31),
  'floor-warroom': sf('floors', 13, 3),
  'floor-hallway': sf('floors', 5, 31),
  'floor-rec': sf('floors', 1, 16),

  // Band 0 (cols 0-2, center=1)
  'floor-b0-white':       sf('floors', 1, 4),
  'floor-b0-cream':       sf('floors', 1, 7),
  'floor-b0-yellow':      sf('floors', 1, 10),
  'floor-b0-gold':        sf('floors', 1, 13),
  'floor-b0-brown':       sf('floors', 1, 16),
  'floor-b0-tan':         sf('floors', 1, 19),
  'floor-b0-sand':        sf('floors', 1, 22),
  'floor-b0-grey':        sf('floors', 1, 25),
  'floor-b0-slate':       sf('floors', 1, 28),
  'floor-b0-wood':        sf('floors', 1, 31),
  'floor-b0-dark-wood':   sf('floors', 1, 34),
  'floor-b0-plank':       sf('floors', 1, 37),

  // Band 1 (cols 3-5, center=4)
  'floor-b1-white':       sf('floors', 4, 4),
  'floor-b1-cream':       sf('floors', 4, 7),
  'floor-b1-pattern':     sf('floors', 4, 10),
  'floor-b1-checker':     sf('floors', 4, 13),
  'floor-b1-brown':       sf('floors', 4, 16),
  'floor-b1-brick':       sf('floors', 4, 19),
  'floor-b1-herring':     sf('floors', 4, 22),
  'floor-b1-stone':       sf('floors', 4, 25),
  'floor-b1-tile':        sf('floors', 4, 28),
  'floor-b1-wood':        sf('floors', 4, 31),
  'floor-b1-dark':        sf('floors', 4, 34),
  'floor-b1-parquet':     sf('floors', 4, 37),

  // Band 2 (cols 6-8, center=7)
  'floor-b2-pink':        sf('floors', 7, 4),
  'floor-b2-rose':        sf('floors', 7, 7),
  'floor-b2-red':         sf('floors', 7, 10),
  'floor-b2-orange':      sf('floors', 7, 13),
  'floor-b2-terra':       sf('floors', 7, 16),
  'floor-b2-clay':        sf('floors', 7, 19),
  'floor-b2-mosaic':      sf('floors', 7, 22),
  'floor-b2-blue-tile':   sf('floors', 7, 25),
  'floor-b2-diamond':     sf('floors', 7, 28),
  'floor-b2-marble':      sf('floors', 7, 31),
  'floor-b2-granite':     sf('floors', 7, 34),
  'floor-b2-concrete':    sf('floors', 7, 37),

  // Band 3 (cols 9-11, center=10)
  'floor-b3-grey':        sf('floors', 10, 4),
  'floor-b3-steel':       sf('floors', 10, 7),
  'floor-b3-silver':      sf('floors', 10, 10),
  'floor-b3-dark-grey':   sf('floors', 10, 13),
  'floor-b3-charcoal':    sf('floors', 10, 16),
  'floor-b3-cement':      sf('floors', 10, 19),
  'floor-b3-grid':        sf('floors', 10, 22),
  'floor-b3-checker':     sf('floors', 10, 25),
  'floor-b3-tile':        sf('floors', 10, 28),
  'floor-b3-dark-tile':   sf('floors', 10, 31),
  'floor-b3-cobble':      sf('floors', 10, 34),
  'floor-b3-industrial':  sf('floors', 10, 37),

  // Band 4 (cols 12-14, center=13)
  'floor-b4-teal':        sf('floors', 13, 4),
  'floor-b4-seafoam':     sf('floors', 13, 7),
  'floor-b4-green':       sf('floors', 13, 10),
  'floor-b4-olive':       sf('floors', 13, 13),
  'floor-b4-wood-green':  sf('floors', 13, 16),
  'floor-b4-aqua':        sf('floors', 13, 19),
  'floor-b4-sky-tile':    sf('floors', 13, 22),
  'floor-b4-blue':        sf('floors', 13, 25),
  'floor-b4-white-tile':  sf('floors', 13, 28),
  'floor-b4-light-blue':  sf('floors', 13, 31),
  'floor-b4-pastel':      sf('floors', 13, 34),
  'floor-b4-mint':        sf('floors', 13, 37),

  // ── Walls (Room_Builder_Walls_16x16.png, 32 cols × 40 rows) ────────────────
  // 8 bands of 4 cols each. Each band = a different wall color/style.
  // Row 1 col 1 of each band = solid fill tile for interior mass.
  'wall-front': sf('walls', 16, 18),
  'wall-corner-tl': sf('walls', 0, 0),
  'wall-corner-tr': sf('walls', 3, 0),
  'wall-side': sf('walls', 0, 1),
  'wall-top': sf('walls', 1, 1),

  // Wall color bands — solid fill tile (col+1, row 1) of each band
  // Band 0: Light grey/white (cols 0-3)
  'wall-white':        sf('walls', 1, 1),
  // Band 1: Cream/off-white (cols 4-7)
  'wall-cream':        sf('walls', 5, 1),
  // Band 2: Beige/tan (cols 8-11)
  'wall-beige':        sf('walls', 9, 1),
  // Band 3: Yellow/warm (cols 12-15)
  'wall-yellow':       sf('walls', 13, 1),
  // Band 4: Brown/wood (cols 16-19)
  'wall-brown':        sf('walls', 17, 1),
  // Band 5: Dark brown (cols 20-23)
  'wall-dark-brown':   sf('walls', 21, 1),
  // Band 6: Grey (cols 24-27)
  'wall-grey':         sf('walls', 25, 1),
  // Band 7: Dark grey/charcoal (cols 28-31)
  'wall-dark-grey':    sf('walls', 29, 1),

  // Additional wall rows (different textures per band)
  // Row 5 = brick-like variant
  'wall-white-brick':      sf('walls', 1, 5),
  'wall-cream-brick':      sf('walls', 5, 5),
  'wall-beige-brick':      sf('walls', 9, 5),
  'wall-yellow-brick':     sf('walls', 13, 5),
  'wall-brown-brick':      sf('walls', 17, 5),
  'wall-dark-brown-brick': sf('walls', 21, 5),
  'wall-grey-brick':       sf('walls', 25, 5),
  'wall-dark-grey-brick':  sf('walls', 29, 5),

  // Row 9 = panel/stripe variant
  'wall-white-panel':      sf('walls', 1, 9),
  'wall-cream-panel':      sf('walls', 5, 9),
  'wall-beige-panel':      sf('walls', 9, 9),
  'wall-yellow-panel':     sf('walls', 13, 9),
  'wall-brown-panel':      sf('walls', 17, 9),
  'wall-dark-brown-panel': sf('walls', 21, 9),
  'wall-grey-panel':       sf('walls', 25, 9),
  'wall-dark-grey-panel':  sf('walls', 29, 9),

  // Row 18 = another style variant
  'wall-white-alt':        sf('walls', 1, 18),
  'wall-cream-alt':        sf('walls', 5, 18),
  'wall-beige-alt':        sf('walls', 9, 18),
  'wall-yellow-alt':       sf('walls', 13, 18),
  'wall-brown-alt':        sf('walls', 17, 18),
  'wall-dark-brown-alt':   sf('walls', 21, 18),
  'wall-grey-alt':         sf('walls', 25, 18),
  'wall-dark-grey-alt':    sf('walls', 29, 18),

  // Legacy 3d-wall aliases — NOT used for rendering, kept to avoid TS errors on old refs
  'wall-3d-front': sf('walls', 16, 18),
  'wall-3d-corner-tl': sf('walls', 0, 0),
  'wall-3d-corner-tr': sf('walls', 3, 0),
  'wall-3d-side-l': sf('walls', 0, 1),
  'wall-3d-side-r': sf('walls', 3, 1),
  'wall-3d-top': sf('walls', 1, 1),

  // ── Door ───────────────────────────────────────────────────────────────────
  // Use hallway floor for door tiles (doorways are floor-level walkable gaps)
  'door': sf('floors', 10, 35),

  // ── Furniture from Generic sheet (1_Generic_16x16.png, 16 cols x 78 rows) ─
  // Coordinates VERIFIED by visual inspection in sprite-debugger at 4× zoom (2026-03-18).
  //
  // Row 0-3: Storage units — TV/wardrobe (0-1), computer tower (2-3), windows/blinds (4-15)
  // Row 5-7: Desks and chairs — orange wood desk (0-1 and 2-3), round chair (4-5)
  // Row 8-10: Large storage — dark bookshelves (0-1 and 2-3)
  // Row 13-14: Large flat screen TV (4-7)
  // Row 18-19: Small potted plant (0), small chair/stool variants (1-2)
  // Row 28-30: Wide desks / conference desks (0-5), potted trees (10-11)
  // Row 34-39: More desks (various widths and wood tones)
  // Row 40: Desk phones — grey (8), blue (9), grey-blue (10), blue-white (11)
  // Row 41-42: Doors (0-4), small drawers (4-5)
  //
  'desk-wood-2wide': sf('generic', 0, 5, 2, 3),    // orange/wood desk, 2 cols × 3 rows (top-down)
  'desk-wood-3wide': sf('generic', 2, 34, 4, 3),   // light wood 4-wide desk (rows 34-36)
  'chair-office':    sf('generic', 4, 5, 2, 2),    // round office chair, golden-tan (rows 5-6)
  'monitor':         sf('generic', 4, 13, 4, 2),   // large flat-screen monitor/TV (rows 13-14)
  'bookshelf-2tall': sf('generic', 0, 8, 2, 3),    // dark 2×3 bookshelf/storage (rows 8-10)
  'plant-potted':    sf('generic', 0, 18, 1, 2),   // small round potted plant (rows 18-19)
  'plant-large-g':   sf('generic', 10, 28, 2, 2),  // potted tree plant (rows 28-29)
  'water-cooler':    sf('generic', 9, 40, 1, 1),   // blue desk phone (placeholder until verified)
  'filing-cabinet':  sf('generic', 4, 41, 1, 2),   // small filing cabinet/drawers (rows 41-42)
  'desk-lamp':       sf('generic', 5, 41, 1, 2),   // small item next to cabinet (rows 41-42)
  'keyboard':        sf('generic', 2, 0, 2, 3),    // computer tower — used as keyboard placeholder
  'phone-desk':      sf('generic', 8, 40, 1, 1),   // grey desk phone (row 40 col 8)
  'cabinet-2wide':   sf('generic', 0, 34, 2, 3),   // dark 2×3 desk variant (rows 34-36)
  'shelf-wall':      sf('generic', 2, 8, 2, 3),    // 2nd bookshelf variant (rows 8-10)
  'rug-office':      sf('generic', 1, 22, 3, 4),   // red ornate rug (rows 22-25, cols 1-3)

  // ── Conference Hall (13_Conference_Hall_16x16.png, 16 cols x 12 rows) ──────
  // Verified against sprite image:
  //  - Large landscape table: cols 0-4, rows 2-4 (5 wide × 3 tall)
  //  - Side chairs (brown, top-facing): cols 0-1, rows 5-6 (2×2)
  //  - Whiteboard panel: cols 10-12, rows 0-1 (3×2)
  'conf-table': sf('conference', 0, 2, 5, 3),
  'table-conference': sf('conference', 0, 2, 5, 3),
  // Conference chair - visible at rows 5-6, cols 0-1
  'conf-chair': sf('conference', 0, 5, 2, 2),
  // Whiteboard - top-right area cols 10-12, rows 0-1
  'whiteboard': sf('conference', 10, 0, 3, 2),
  'conf-whiteboard': sf('conference', 10, 0, 3, 2),
  // Projector (right side)
  'conf-projector': sf('conference', 13, 0, 2, 1),
  // Podium (right edge)
  'conf-podium': sf('conference', 14, 0, 2, 2),

  // ── Film Studio (23_Television_and_Film_Studio.png, 16 cols x 14 rows) ─────
  'camera': sf('film-studio', 0, 0, 2, 3),
  'clapboard': sf('film-studio', 4, 0, 2, 1),
  'film-reel': sf('film-studio', 8, 3),
  'director-chair': sf('film-studio', 8, 4, 2, 2),
  'studio-light': sf('film-studio', 2, 0, 2, 3),
  'studio-monitor': sf('film-studio', 10, 4, 2, 2),

  // ── Living Room (2_LivingRoom_16x16.png, 16 cols x 45 rows) ───────────────
  // Content map verified: rows 0-1 have content at cols 2-5, 10-14
  'couch-2wide': sf('living-room', 2, 0, 3, 2),
  'armchair': sf('living-room', 5, 0, 2, 2),
  'coffee-table': sf('living-room', 2, 4, 2, 1),
  'plant-large': sf('living-room', 10, 0, 2, 2),
  'cushion': sf('living-room', 7, 7),
  'floor-lamp': sf('living-room', 9, 4, 1, 2),

  // ── Classroom/Library (5_Classroom_and_library_16x16.png, 16 cols x 34 rows)
  'bookshelf-library': sf('classroom', 0, 10, 3, 3),
  'desk-study': sf('classroom', 0, 0, 2, 2),
  'chalkboard': sf('classroom', 4, 2, 3, 2),

  // ── 48×48 Tier — Same grid layout as 16×16, 3× resolution ──────────────────
  // Used for editor thumbnails and high-res rendering.
  // Coordinates: same col/row as sf() entries above, just using sf48().
  //
  // Generic sheet (generic-48) — same col/row as 16×16 above, verified by sprite debugger
  'desk-wood-2wide-48':    sf48('generic-48', 0, 5, 2, 3),
  'desk-wood-3wide-48':    sf48('generic-48', 2, 34, 4, 3),
  'chair-office-48':       sf48('generic-48', 4, 5, 2, 2),
  'monitor-48':            sf48('generic-48', 4, 13, 4, 2),
  'bookshelf-2tall-48':    sf48('generic-48', 0, 8, 2, 3),
  'plant-potted-48':       sf48('generic-48', 0, 18, 1, 2),
  'water-cooler-48':       sf48('generic-48', 9, 40, 1, 1),
  'filing-cabinet-48':     sf48('generic-48', 4, 41, 1, 2),
  'desk-lamp-48':          sf48('generic-48', 5, 41, 1, 2),
  'keyboard-48':           sf48('generic-48', 2, 0, 2, 3),
  'phone-desk-48':         sf48('generic-48', 8, 40, 1, 1),
  'cabinet-2wide-48':      sf48('generic-48', 0, 34, 2, 3),
  'shelf-wall-48':         sf48('generic-48', 2, 8, 2, 3),
  'rug-office-48':         sf48('generic-48', 1, 22, 3, 4),
  'desk-plant-48':         sf48('generic-48', 0, 18, 1, 2),
  //
  // Conference Hall sheet (conference-48)
  'conf-table-48':         sf48('conference-48', 0, 2, 5, 3),
  'conf-chair-48':         sf48('conference-48', 0, 5, 2, 2),
  'whiteboard-48':         sf48('conference-48', 10, 0, 3, 2),
  'conf-whiteboard-48':    sf48('conference-48', 10, 0, 3, 2),
  'conf-projector-48':     sf48('conference-48', 13, 0, 2, 1),
  'conf-podium-48':        sf48('conference-48', 14, 0, 2, 2),
  //
  // Film Studio sheet (film-studio-48)
  'camera-48':             sf48('film-studio-48', 0, 0, 2, 3),
  'clapboard-48':          sf48('film-studio-48', 4, 0, 2, 1),
  'film-reel-48':          sf48('film-studio-48', 8, 3),
  'director-chair-48':     sf48('film-studio-48', 8, 4, 2, 2),
  'studio-light-48':       sf48('film-studio-48', 2, 0, 2, 3),
  'studio-monitor-48':     sf48('film-studio-48', 10, 4, 2, 2),
  //
  // Living Room sheet (living-room-48)
  'couch-2wide-48':        sf48('living-room-48', 2, 0, 3, 2),
  'armchair-48':           sf48('living-room-48', 5, 0, 2, 2),
  'coffee-table-48':       sf48('living-room-48', 2, 4, 2, 1),
  'plant-large-48':        sf48('living-room-48', 10, 0, 2, 2),
  'cushion-48':            sf48('living-room-48', 7, 7),
  'floor-lamp-48':         sf48('living-room-48', 9, 4, 1, 2),
  //
  // Classroom sheet (classroom-48)
  'bookshelf-library-48':  sf48('classroom-48', 0, 10, 3, 3),
  'desk-study-48':         sf48('classroom-48', 0, 0, 2, 2),
  'chalkboard-48':         sf48('classroom-48', 4, 2, 3, 2),

  // ── Decoration: Agent Personality Items ────────────────────────────────────
  // Using verified non-transparent positions
  'patrik-chart': sf('generic', 8, 3, 2, 2),
  'marcos-lawbooks': sf('classroom', 0, 10, 2, 2),
  'sandra-whiteboard': sf('conference', 1, 0, 3, 2),
  'isaac-corkboard': sf('generic', 10, 8, 2, 2),
  'wendy-plant': sf('living-room', 10, 0, 2, 2),
  'billy-clapboard': sf('film-studio', 4, 0, 2, 1),
  'wendy-motivational': sf('generic', 8, 3, 2, 2),
  'isaac-scripts': sf('film-studio', 6, 0, 2, 1),
  'patrik-calculator': sf('generic', 10, 0),
  'marcos-gavel': sf('generic', 11, 0),
  'sandra-schedule': sf('generic', 12, 5, 2, 1),
  'billy-award': sf('generic', 8, 4, 2, 2),

  // ── Personal Touch Decorations (small desk items from Generic sheet) ────
  // Row 0-1 cols 8-15 verified as having content
  'coffee-mug': sf('generic', 10, 1),
  'pen-holder': sf('generic', 11, 1),
  'photo-frame': sf('generic', 12, 3),
  'desk-plant': sf('generic', 14, 9),
  'figurine': sf('generic', 13, 0),
  'candle': sf('generic', 15, 0),
  'papers': sf('generic', 13, 1),
  'water-glass': sf('generic', 14, 1),
  'postit-note': sf('generic', 15, 1),

  // ── UI Elements ────────────────────────────────────────────────────────────
  // Emotes sheet: rows 0-3 are sparse/animated frames, rows 4+ are dense static emotes
  'emote-thinking': sf('ui-emotes', 4, 0),      // thought bubble (verified 15 pixels)
  'emote-exclamation': sf('ui-emotes', 0, 4),    // exclamation mark
  'emote-question': sf('ui-emotes', 2, 4),       // question mark
  'emote-heart': sf('ui-emotes', 4, 4),          // heart
  'emote-music': sf('ui-emotes', 6, 4),          // music note
  'emote-stretch': sf('ui-emotes', 8, 4),        // star/sparkle = closest arms-up/celebrate analog

  // Speech bubbles (UI_16x16.png, 18 cols x 16 rows)
  'speech-bubble-left': sf('ui', 0, 8, 2, 2),
  'speech-bubble-right': sf('ui', 2, 8, 2, 2),
  'speech-bubble-small': sf('ui', 4, 8),

  // Floor shadows (Room_Builder_Floor_Shadows_16x16.png)
  'shadow-top': sf('floor-shadows', 1, 0),
  'shadow-left': sf('floor-shadows', 0, 1),
  'shadow-corner': sf('floor-shadows', 0, 0),
  'shadow-right': sf('floor-shadows', 2, 1),
  'shadow-bottom': sf('floor-shadows', 1, 2),

  // ── MetroCity Characters (32x32 frames) ───────────────────────────────────
  // Character Model: 768x192 = 24 cols × 6 rows at 32px
  // Row 0-1: light skin, Row 2-3: medium skin, Row 4-5: dark skin
  // Col 0 of each row = front-facing idle frame
  'metro-char-light':  { sheetId: 'metro-char', frame: { x: 0,  y: 0,   w: 32, h: 32 } },
  'metro-char-medium': { sheetId: 'metro-char', frame: { x: 0,  y: 64,  w: 32, h: 32 } },
  'metro-char-dark':   { sheetId: 'metro-char', frame: { x: 0,  y: 128, w: 32, h: 32 } },

  // Hairs: 768x256 = 24 cols × 8 rows at 32px (one row per hair style/color)
  'metro-hair-brown':  { sheetId: 'metro-hairs', frame: { x: 0, y: 0,   w: 32, h: 32 } },
  'metro-hair-blonde': { sheetId: 'metro-hairs', frame: { x: 0, y: 32,  w: 32, h: 32 } },
  'metro-hair-red':    { sheetId: 'metro-hairs', frame: { x: 0, y: 64,  w: 32, h: 32 } },
  'metro-hair-orange': { sheetId: 'metro-hairs', frame: { x: 0, y: 96,  w: 32, h: 32 } },
  'metro-hair-black':  { sheetId: 'metro-hairs', frame: { x: 0, y: 192, w: 32, h: 32 } },

  // Outfits: 768x32 each = 24 cols × 1 row at 32px (front-facing idle)
  'metro-outfit-1': { sheetId: 'metro-outfit1', frame: { x: 0, y: 0, w: 32, h: 32 } },
  'metro-outfit-2': { sheetId: 'metro-outfit2', frame: { x: 0, y: 0, w: 32, h: 32 } },
  'metro-outfit-3': { sheetId: 'metro-outfit3', frame: { x: 0, y: 0, w: 32, h: 32 } },
  'metro-outfit-4': { sheetId: 'metro-outfit4', frame: { x: 0, y: 0, w: 32, h: 32 } },
  'metro-outfit-5': { sheetId: 'metro-outfit5', frame: { x: 0, y: 0, w: 32, h: 32 } },
  'metro-outfit-6': { sheetId: 'metro-outfit6', frame: { x: 0, y: 0, w: 32, h: 32 } },
  'metro-suit':     { sheetId: 'metro-suit',    frame: { x: 0, y: 0, w: 32, h: 32 } },
};
