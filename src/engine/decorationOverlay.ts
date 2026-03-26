/**
 * Decoration Overlay — world-space sprite-crop rendering for Decorate Mode.
 *
 * PlacedDecoration items are stored in editorStore and persisted to localStorage.
 * They render ABOVE the pixelScene hand-drawn art (Layer 4.6 in renderer.ts).
 *
 * Three placement kinds:
 *  • 'atlas'    — looks up frame in LIMEZU_ATLAS by atlasKey48 (legacy)
 *  • 'custom'   — direct pixel rect from a named 48×48 sheet (Simple Piece)
 *  • 'assembled'— multiple sprite crops arranged on a grid (Assembly Builder)
 *
 * Right-click on canvas in Decorate Mode removes the nearest placed decoration.
 */
import { LIMEZU_ATLAS } from './limeZuAtlas';
import { getEnvironmentSheetById } from './spriteSheet';

// ── Piece Definitions (from Furniture Composer) ───────────────────────────────

/** A placement within an assembled piece */
export interface AssemblyPlacement {
  sheetId: string;
  srcX: number; srcY: number; srcW: number; srcH: number;
  gridCol: number; gridRow: number;
}

/** Simple rectangular sprite crop */
export interface SimpleComposerPiece {
  id: string;
  kind?: never; // undefined = simple
  name: string;
  category: string;
  sheetId: string;
  col: number; row: number; cols: number; rows: number;
}

/** Multi-part assembled piece */
export interface AssembledComposerPiece {
  id: string;
  kind: 'assembled';
  name: string;
  category: string;
  gridW: number;
  gridH: number;
  placements: AssemblyPlacement[];
}

export type ComposerPieceDef = SimpleComposerPiece | AssembledComposerPiece;

const COMPOSER_KEY = 'lemon_piece_defs_v1';

/** Returns all pieces saved in the Furniture Composer. */
export function loadComposerPieces(): ComposerPieceDef[] {
  try {
    const raw = localStorage.getItem(COMPOSER_KEY);
    return raw ? (JSON.parse(raw) as ComposerPieceDef[]) : [];
  } catch { return []; }
}

// ── Placed Decoration Types ───────────────────────────────────────────────────

export interface PlacedDecoration {
  id: string;
  kind: 'atlas' | 'custom' | 'assembled';
  // atlas
  atlasKey48?: string;
  // custom
  sheetId?: string; srcX?: number; srcY?: number; srcW?: number; srcH?: number;
  // assembled
  placements?: AssemblyPlacement[];
  // common
  worldX: number; worldY: number; worldW: number; worldH: number;
}

export interface GhostState {
  kind: 'atlas' | 'custom' | 'assembled';
  atlasKey48?: string;
  sheetId?: string; srcX?: number; srcY?: number; srcW?: number; srcH?: number;
  placements?: AssemblyPlacement[];
  worldX: number; worldY: number; worldW: number; worldH: number;
}

// ── Tile constants ─────────────────────────────────────────────────────────────

const TILE_SRC   = 48;  // source pixels per tile in 48×48 sheets
const TILE_WORLD = 16;  // world pixels per tile

// ── Render ───────────────────────────────────────────────────────────────────

/**
 * Renders all placed decorations and an optional ghost preview.
 * ctx must already have the world transform applied (zoom * dpr).
 */
export function renderDecorationOverlay(
  ctx: CanvasRenderingContext2D,
  decorations: PlacedDecoration[],
  ghost: GhostState | null,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const dec of decorations)        drawDecoration(ctx, dec, 1.0);
  if (ghost)                             drawGhost(ctx, ghost);
}

function drawDecoration(ctx: CanvasRenderingContext2D, dec: PlacedDecoration, alpha: number): void {
  switch (dec.kind) {
    case 'atlas':     drawAtlas(ctx, dec.atlasKey48!, dec.worldX, dec.worldY, dec.worldW, dec.worldH, alpha); break;
    case 'custom':    drawCrop(ctx, dec.sheetId!, dec.srcX!, dec.srcY!, dec.srcW!, dec.srcH!, dec.worldX, dec.worldY, dec.worldW, dec.worldH, alpha); break;
    case 'assembled': drawAssembled(ctx, dec.placements!, dec.worldX, dec.worldY, alpha); break;
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, g: GhostState): void {
  drawDecoration(ctx, { ...g, id: '', worldW: g.worldW, worldH: g.worldH } as PlacedDecoration, 0.5);
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = 'rgba(59,130,246,0.9)';
  ctx.lineWidth   = 0.8;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(g.worldX, g.worldY, g.worldW, g.worldH);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAtlas(
  ctx: CanvasRenderingContext2D,
  key: string, dstX: number, dstY: number, dstW: number, dstH: number, alpha: number,
): void {
  const sf = LIMEZU_ATLAS[key];
  if (!sf) return;
  const sheet = getEnvironmentSheetById(sf.sheetId);
  if (!sheet) return;
  // Source rect: frame.w/h === 0 means "use the whole sheet"
  const srcW = sf.frame.w === 0 ? sheet.naturalWidth  : sf.frame.w;
  const srcH = sf.frame.h === 0 ? sheet.naturalHeight : sf.frame.h;
  // Destination always uses the caller-supplied world size (respects scale)
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(sheet, sf.frame.x, sf.frame.y, srcW, srcH, dstX, dstY, dstW, dstH);
  ctx.restore();
}


function drawCrop(
  ctx: CanvasRenderingContext2D,
  sheetId: string, srcX: number, srcY: number, srcW: number, srcH: number,
  dstX: number, dstY: number, dstW: number, dstH: number, alpha: number,
): void {
  const sheet = getEnvironmentSheetById(sheetId);
  if (!sheet) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(sheet, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
  ctx.restore();
}

function drawAssembled(
  ctx: CanvasRenderingContext2D,
  placements: AssemblyPlacement[],
  worldX: number, worldY: number, alpha: number,
): void {
  for (const p of placements) {
    const sheet = getEnvironmentSheetById(p.sheetId);
    if (!sheet) continue;
    const tileSpansW = p.srcW / TILE_SRC;
    const tileSpansH = p.srcH / TILE_SRC;
    const dstX = worldX + p.gridCol * TILE_WORLD;
    const dstY = worldY + p.gridRow * TILE_WORLD;
    const dstW = tileSpansW * TILE_WORLD;
    const dstH = tileSpansH * TILE_WORLD;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(sheet, p.srcX, p.srcY, p.srcW, p.srcH, dstX, dstY, dstW, dstH);
    ctx.restore();
  }
}

// ── Hit Test ─────────────────────────────────────────────────────────────────

export function hitTestDecoration(
  decorations: PlacedDecoration[],
  worldX: number, worldY: number,
): string | null {
  for (let i = decorations.length - 1; i >= 0; i--) {
    const dec = decorations[i]!;
    if (worldX >= dec.worldX && worldX < dec.worldX + dec.worldW &&
        worldY >= dec.worldY && worldY < dec.worldY + dec.worldH) {
      return dec.id;
    }
  }
  return null;
}

// ── Helpers (used by OfficeCanvas for placement) ──────────────────────────────

export function customPieceSrc(p: SimpleComposerPiece) {
  return { x: p.col * TILE_SRC, y: p.row * TILE_SRC, w: p.cols * TILE_SRC, h: p.rows * TILE_SRC };
}

export function customPieceWorldSize(p: SimpleComposerPiece)  { return { w: p.cols * TILE_WORLD, h: p.rows * TILE_WORLD }; }
export function assembledWorldSize(p: AssembledComposerPiece) { return { w: p.gridW * TILE_WORLD, h: p.gridH * TILE_WORLD }; }

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lemon.placedDecorations';

export function loadPlacedDecorations(): PlacedDecoration[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) as PlacedDecoration[] : []; }
  catch { return []; }
}

export function savePlacedDecorations(decs: PlacedDecoration[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(decs)); } catch {}
}
