/**
 * Scans Theme_Sorter_Singles_48x48 (individual PNGs) and Theme_Sorter_48x48
 * (compiled sheets) to generate src/engine/furniture48Catalog.ts.
 *
 * Singles → entries with src pointing to individual PNG (use <img> tag).
 * Compiled → entries with frameX/Y/W/H for CSS background-clip display.
 *
 * Run: npx tsx scripts/generateFurnitureCatalog.ts
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SINGLES_DIR = join(ROOT, 'public/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_Singles_48x48');
const COMPILED_DIR = join(ROOT, 'public/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48');
const SINGLES_PUBLIC = '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_Singles_48x48';
const COMPILED_PUBLIC = '/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48';
const FRAME_SIZE = 48;

const OUT_FILE = join(ROOT, 'src/engine/furniture48Catalog.ts');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readPngDims(filePath: string): { w: number; h: number } {
  const buf = readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function toThemeKey(name: string): string {
  return name
    .replace(/^\d+_/, '')
    .replace(/_(Singles_)?48x48$/i, '')
    .replace(/_Singles$/i, '')
    .replace(/_/g, '-')
    .toLowerCase()
    .trim();
}

function toThemeLabel(name: string): string {
  const label = name
    .replace(/^\d+_/, '')
    .replace(/_(Singles_)?48x48$/i, '')
    .replace(/_Singles$/i, '')
    .replace(/_/g, ' ')
    .trim();
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fileToN(filename: string): number {
  const match = filename.match(/_(\d+)\.png$/i);
  return match ? parseInt(match[1]!, 10) : 0;
}

// ── Entry type ────────────────────────────────────────────────────────────────

interface Entry {
  key: string;
  src: string;       // public URL (individual PNG for singles; sheet PNG for compiled)
  themeKey: string;
  themeLabel: string;
  n: number;
  // Present only for compiled-sheet cells:
  frameX?: number;
  frameY?: number;
  frameW?: number;
  frameH?: number;
  sheetW?: number;
  sheetH?: number;
}

// ── 1. Scan Singles folders ───────────────────────────────────────────────────

const singlesEntries: Entry[] = [];
const singlesThemeKeys = new Set<string>();

const themeFolders = readdirSync(SINGLES_DIR)
  .filter((f) => statSync(join(SINGLES_DIR, f)).isDirectory())
  .sort();

for (const folder of themeFolders) {
  const themeKey = toThemeKey(folder);
  const themeLabel = toThemeLabel(folder);
  singlesThemeKeys.add(themeKey);
  const folderPath = join(SINGLES_DIR, folder);

  const files = readdirSync(folderPath)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => fileToN(a) - fileToN(b));

  for (const file of files) {
    const n = fileToN(file);
    singlesEntries.push({
      key: `48-${themeKey}-${n}`,
      src: `${SINGLES_PUBLIC}/${folder}/${file}`,
      themeKey,
      themeLabel,
      n,
    });
  }
}

console.log(`Singles: ${singlesEntries.length} sprites across ${themeFolders.length} themes.`);

// ── 2. Scan compiled sheets for themes NOT covered by Singles ─────────────────
//    (Currently only 1_Generic_48x48.png has no Singles counterpart)

const compiledEntries: Entry[] = [];
const compiledSheetPaths: Record<string, string> = {};

const compiledFiles = readdirSync(COMPILED_DIR)
  .filter((f) => f.endsWith('.png') && !f.toLowerCase().includes('shadowless'))
  .sort();

// Normalized set for deduplication: strip all dashes/spaces for fuzzy matching
const singlesNormalized = new Set(Array.from(singlesThemeKeys).map((k) => k.replace(/-/g, '')));

for (const file of compiledFiles) {
  const rawKey = toThemeKey(file.replace(/\.png$/i, ''));
  // Skip if this theme already has Singles (avoid duplicates — normalize for camelCase filenames)
  if (singlesNormalized.has(rawKey.replace(/-/g, ''))) continue;

  const themeKey = `c-${rawKey}`;  // "c-" prefix = compiled sheet source

  // Human label: prepend "(Office)" to Generic so it's obvious
  let label = toThemeLabel(file.replace(/\.png$/i, ''));
  if (rawKey === 'generic') label = 'Generic (Office)';

  const filePath = join(COMPILED_DIR, file);
  const { w: sheetW, h: sheetH } = readPngDims(filePath);
  const cols = Math.floor(sheetW / FRAME_SIZE);
  const rows = Math.floor(sheetH / FRAME_SIZE);
  const src = `${COMPILED_PUBLIC}/${file}`;
  const sheetId = `compiled-${rawKey}`;

  compiledSheetPaths[sheetId] = src;

  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      compiledEntries.push({
        key: `48c-${rawKey}-${n}`,
        src,
        themeKey,
        themeLabel: label,
        n,
        frameX: col * FRAME_SIZE,
        frameY: row * FRAME_SIZE,
        frameW: FRAME_SIZE,
        frameH: FRAME_SIZE,
        sheetW,
        sheetH,
      });
      n++;
    }
  }

  console.log(`Compiled: ${file} → ${n} cells (${cols}×${rows}), sheetId="${sheetId}"`);
}

// ── 3. Merge & order: compiled (office first) + singles ───────────────────────

// Sort compiled so Generic comes first
compiledEntries.sort((a, b) => {
  if (a.themeKey === 'c-generic') return -1;
  if (b.themeKey === 'c-generic') return 1;
  return a.themeKey.localeCompare(b.themeKey);
});

const allEntries: Entry[] = [...compiledEntries, ...singlesEntries];

const byTheme: Record<string, Entry[]> = {};
for (const entry of allEntries) {
  (byTheme[entry.themeKey] ??= []).push(entry);
}

// ── 4. Emit TypeScript ────────────────────────────────────────────────────────

function entryToTs(e: Entry): string {
  const base = `key: ${JSON.stringify(e.key)}, src: ${JSON.stringify(e.src)}, themeKey: ${JSON.stringify(e.themeKey)}, themeLabel: ${JSON.stringify(e.themeLabel)}, n: ${e.n}`;
  if (e.frameX !== undefined) {
    return `  { ${base}, frameX: ${e.frameX}, frameY: ${e.frameY}, frameW: ${e.frameW}, frameH: ${e.frameH}, sheetW: ${e.sheetW}, sheetH: ${e.sheetH} },`;
  }
  return `  { ${base} },`;
}

const catalogLines = allEntries.map(entryToTs).join('\n');

const byThemeLines = Object.entries(byTheme)
  .map(([tk, entries]) => {
    const keys = entries.map((e) => `    ${JSON.stringify(e.key)}`).join(',\n');
    return `  ${JSON.stringify(tk)}: [\n${keys}\n  ]`;
  })
  .join(',\n');

const atlasLines = allEntries.map((e) => {
  if (e.frameX !== undefined) {
    // Compiled cell: specific frame crop in the sheet
    const sheetId = `compiled-${e.themeKey.replace(/^c-/, '')}`;
    return `  ${JSON.stringify(e.key)}: { sheetId: ${JSON.stringify(sheetId)}, frame: { x: ${e.frameX}, y: ${e.frameY}, w: ${e.frameW}, h: ${e.frameH} } },`;
  }
  // Singles: full-image sentinel (w=0,h=0)
  return `  ${JSON.stringify(e.key)}: { sheetId: ${JSON.stringify(e.key)}, frame: { x: 0, y: 0, w: 0, h: 0 } },`;
}).join('\n');

const sheetPathLines = singlesEntries
  .map((e) => `  ${JSON.stringify(e.key)}: ${JSON.stringify(e.src)},`)
  .join('\n');

const compiledSheetPathLines = Object.entries(compiledSheetPaths)
  .map(([id, path]) => `  ${JSON.stringify(id)}: ${JSON.stringify(path)},`)
  .join('\n');

const totalThemes = Object.keys(byTheme).length;

const output = `/**
 * AUTO-GENERATED by scripts/generateFurnitureCatalog.ts — do not edit manually.
 * Re-run: npx tsx scripts/generateFurnitureCatalog.ts
 *
 * ${compiledEntries.length} compiled-sheet cells + ${singlesEntries.length} Singles = ${allEntries.length} total entries, ${totalThemes} themes.
 * Generic (Office) is first — compiled from 1_Generic_48x48.png (16×78 grid).
 * All other themes come from Theme_Sorter_Singles_48x48/.
 */
import type { SheetFrame } from './limeZuAtlas';

export interface Furniture48Entry {
  key: string;        // atlas key, e.g. "48c-generic-5" or "48-conference-hall-12"
  src: string;        // public URL — sheet PNG for compiled, individual PNG for singles
  themeKey: string;   // e.g. "c-generic" or "conference-hall"
  themeLabel: string; // e.g. "Generic (Office)" or "Conference Hall"
  n: number;          // frame index (linearised col+row*cols) or file number
  // Only present for compiled-sheet cells:
  frameX?: number;    // pixel x offset within the sheet
  frameY?: number;    // pixel y offset within the sheet
  frameW?: number;    // frame width (always ${FRAME_SIZE} for compiled)
  frameH?: number;    // frame height (always ${FRAME_SIZE} for compiled)
  sheetW?: number;    // total sheet width (for CSS background-size)
  sheetH?: number;    // total sheet height
}

export const FURNITURE_48_CATALOG: Furniture48Entry[] = [
${catalogLines}
];

/** Entries grouped by themeKey. */
export const FURNITURE_48_BY_THEME: Record<string, string[]> = {
${byThemeLines}
};

/** Theme keys in display order (compiled/office themes first). */
export const FURNITURE_48_THEMES: string[] = ${JSON.stringify(Object.keys(byTheme))};

/** Human-readable theme label keyed by themeKey. */
export const FURNITURE_48_THEME_LABELS: Record<string, string> = {
${Object.entries(byTheme).map(([tk, es]) => `  ${JSON.stringify(tk)}: ${JSON.stringify(es[0]!.themeLabel)},`).join('\n')}
};

/**
 * Atlas entries for all furniture sprites.
 * Compiled cells: real frame coords in the sheet.
 * Singles: w=0,h=0 sentinel → renderer uses naturalWidth/naturalHeight.
 */
export const FURNITURE_48_ATLAS_ENTRIES: Record<string, SheetFrame> = {
${atlasLines}
};

/**
 * Sheet paths for Singles (lazy-loaded one-per-file by spriteSheet.ts).
 */
export const FURNITURE_48_SHEET_PATHS: Record<string, string> = {
${sheetPathLines}
};

/**
 * Sheet paths for compiled theme sheets (eagerly loaded — only ~1 per theme).
 * Add these to SHEET_PATHS in limeZuAtlas.ts.
 */
export const FURNITURE_COMPILED_SHEET_PATHS: Record<string, string> = {
${compiledSheetPathLines}
};
`;

writeFileSync(OUT_FILE, output, 'utf8');
console.log(`\nWritten ${allEntries.length} entries to ${OUT_FILE}`);
