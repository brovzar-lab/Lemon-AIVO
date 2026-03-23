/**
 * Layered Canvas 2D rendering pipeline using ctx.setTransform().
 *
 * Draw order per frame (6-layer):
 *   Layer 1: Clear canvas at identity transform
 *   Layer 2: Floor tiles at world transform (with viewport culling)
 *   Layer 3: 3/4 perspective wall strips + shadows at world transform
 *   Layer 3b: Drop zone highlight at world transform
 *   Layer 4: Y-sorted renderables (furniture + decorations + characters merged) at world transform
 *   Layer 4.5: Glow effects (additive radial gradients, day/night modulated) at world transform
 *   --- Reset to identity transform ---
 *   Layer 5: Status overlays (speech bubbles, thinking dots) at screen coords
 *   Layer 5b: File icons on agent desks at screen coords
 *   Layer 6: UI overlays (room labels) at screen coords
 *   Layer 6b: Invalid drop tooltip at screen coords
 *
 * World-space layers use ctx.setTransform(zoom, 0, 0, zoom, tx, ty) so all
 * drawing happens at world coordinates (col * TILE_SIZE). The transform handles
 * zoom scaling uniformly, eliminating tile gaps at fractional zoom levels.
 *
 * UI overlays reset to identity and use worldToScreen() for positioning.
 */
import { TILE_SIZE, CHAR_SPRITE_W, CHAR_SPRITE_H } from './types';
import type { Camera, Character } from './types';
import type { FurnitureItem, DecorationItem } from './officeLayout';
import { OFFICE_TILE_MAP, ROOMS, getFurnitureAt, FURNITURE } from './officeLayout';
import { getCollisionAt } from './tileMap';
import { PLACEHOLDER_COLORS, getCharacterSheet, getEnvironmentSheetById, getCachedSprite } from './spriteSheet';
import { CHARACTER_FRAMES } from './spriteAtlas';
import { LIMEZU_ATLAS } from './limeZuAtlas';
import type { SheetFrame } from './limeZuAtlas';
import { buildRenderables } from './depthSort';
import { renderGlowEffects } from './glowEffects';
import { computeTimeOfDay } from './timeOfDay';
import { drawScene as drawPixelScene, GAME_W as PIXEL_GAME_W, GAME_H as PIXEL_GAME_H } from './pixelScene';
import { useFileStore } from '@/store/fileStore';
import { dragOverRoomId, invalidDropMessage, invalidDropX, invalidDropY, hoverTileCol, hoverTileRow } from './input';
import { useEditorStore } from '@/store/editorStore';
import { stretchingAgents } from './idleBehaviorManager';
import { collaboratingAgents } from '@/store/collaborationStore';
import { getAgent } from '@/config/agents';

/** Debug: render red semi-transparent tiles over all collision-blocked cells. Set to true manually when debugging collision. */
const DEBUG_COLLISION = false;

/** Dark background matching the app dark theme */
const BG_COLOR = '#5A4012';  // Muted brown — matches pixelScene floor wood tones

/** Frame counter for pixelScene animations (clocks, idle breathing) */
let pixelSceneFrame = 0;


/** Agent room IDs (excludes war-room and billy) */
const AGENT_ROOM_IDS = new Set<string>(['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie']);

/** Currently hovered file ID -- set during renderFileIcons, read by input.ts */
export let hoveredFileId: string | null = null;

// ── Main Render Function ────────────────────────────────────────────────────

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  characters: Character[],
  _activeRoomId: string | null,
  canvasWidth: number,
  canvasHeight: number,
  agentStatuses: Record<string, string>,
  elapsedTime: number = 0,
): void {
  const zoom = camera.zoom;
  const dpr = window.devicePixelRatio || 1;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  const mapRows = OFFICE_TILE_MAP.length;
  const mapWorldW = mapCols * TILE_SIZE;
  const mapWorldH = mapRows * TILE_SIZE;

  // Compute transform: world point (wx, wy) -> screen (wx * zoom + tx, wy * zoom + ty)
  const tx = (canvasWidth - mapWorldW * zoom) / 2 - camera.x;
  const ty = (canvasHeight - mapWorldH * zoom) / 2 - camera.y;

  // Viewport culling: compute visible world rect from screen bounds
  const worldLeft = -tx / zoom;
  const worldTop = -ty / zoom;
  const worldRight = (canvasWidth - tx) / zoom;
  const worldBottom = (canvasHeight - ty) / zoom;
  const minCol = Math.max(0, Math.floor(worldLeft / TILE_SIZE));
  const maxCol = Math.min(mapCols - 1, Math.floor(worldRight / TILE_SIZE));
  const minRow = Math.max(0, Math.floor(worldTop / TILE_SIZE));
  const maxRow = Math.min(mapRows - 1, Math.floor(worldBottom / TILE_SIZE));

  // Helper: convert world coordinates to screen coordinates (for UI overlays)
  function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return { x: worldX * zoom + tx, y: worldY * zoom + ty };
  }

  // ── Layer 1: Clear (identity transform) ────────────────────────────────
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // ── Apply world transform ──────────────────────────────────────────────
  ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, tx * dpr, ty * dpr);
  ctx.imageSmoothingEnabled = false;

  // ── Layer 1b: Pixel Scene (procedural offices from TEST PIXEL TEAM) ────
  pixelSceneFrame++;
  ctx.save();
  ctx.scale(mapWorldW / PIXEL_GAME_W, mapWorldH / PIXEL_GAME_H);
  drawPixelScene(ctx, PIXEL_GAME_W, PIXEL_GAME_H, pixelSceneFrame);
  ctx.restore();

  // ── Layers 2-3 SKIPPED: pixelScene (Layer 1b) handles all room/floor/wall rendering ──
  // The procedural pixel scene draws complete offices with walls, floors, furniture,
  // and decorations. The old tile-map layers would paint over the furniture.

  // ── Layer DEBUG: Collision Overlay (DEV only) ──────────────────────
  if (DEBUG_COLLISION) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.35)';
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (getCollisionAt(col, row)) {
          ctx.fillRect(
            col * TILE_SIZE,
            row * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE,
          );
        }
      }
    }
  }

  // ── Layer 3b: Drop Zone Highlight ──────────────────────────────────────
  renderDropZoneHighlight(ctx, zoom, tx, ty, canvasWidth, canvasHeight, dpr);

  // ── Layer 4: Y-sorted Renderables (furniture + decorations + characters) ──
  const renderables = buildRenderables(
    characters,
    (rCtx, ch) => renderCharacterWorld(rCtx, ch, zoom, agentStatuses),
    (rCtx, item) => renderFurnitureItemWorld(rCtx, item),
    (rCtx, dec) => renderDecorationWorld(rCtx, dec),
  );
  for (const r of renderables) {
    r.draw(ctx);
  }

  // ── Layer 4.5: Glow Effects (additive compositing over scene) ────────
  const timeOfDay = computeTimeOfDay();
  renderGlowEffects(ctx, timeOfDay, elapsedTime);

  // ── Reset to identity for UI overlays ──────────────────────────────────
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Skip game UI overlays in editor mode (editor has its own overlays)
  const isEditing = useEditorStore.getState().editorMode;
  if (!isEditing) {
    // ── Layer 5: Status Overlays (speech bubbles, thinking dots) ────────
    renderStatusOverlays(ctx, characters, agentStatuses, zoom, worldToScreen);

    // ── Layer 5b: File icons on agent desks ─────────────────────────────
    renderFileIcons(ctx, zoom, worldToScreen);

    // ── Layer 5c: Hover glow on interactive furniture ───────────────────
    renderFurnitureHoverGlow(ctx, zoom, worldToScreen);

    // ── Layer 5d: Hover name tooltip ─────────────────────────────────
    renderHoverTooltip(ctx, characters, zoom, worldToScreen);

    // ── Layer 6: SKIPPED — pixelScene renders its own room labels ──────
    // Old room labels disabled to avoid visual duplication with pixelScene labels.
  }
}

// ── Per-Room Floor/Wall Mapping ──────────────────────────────────────────────

// ── LimeZu Tile Drawing Helper ──────────────────────────────────────────────

/**
 * Draws a LimeZu tile from the multi-sheet atlas at the given world position.
 * Returns true if successfully drawn, false if sheet not loaded or key not found.
 * @param ctx - Canvas rendering context
 * @param atlasKey - Key in LIMEZU_ATLAS
 * @param x - World X position
 * @param y - World Y position
 * @param w - Width in pixels (default: TILE_SIZE)
 * @param h - Height in pixels (default: TILE_SIZE)
 */
export function drawLimeZuTile(
  ctx: CanvasRenderingContext2D,
  atlasKey: string,
  x: number,
  y: number,
  w: number = TILE_SIZE,
  h: number = TILE_SIZE,
): boolean {
  const sf = LIMEZU_ATLAS[atlasKey];
  if (!sf) return false;
  const sheet = getEnvironmentSheetById(sf.sheetId);
  if (!sheet) return false;
  ctx.drawImage(
    sheet,
    sf.frame.x, sf.frame.y, sf.frame.w, sf.frame.h,
    x, y, w, h,
  );
  return true;
}

/**
 * Draws a LimeZu tile from a SheetFrame directly (bypasses atlas lookup).
 * Returns true if successfully drawn, false if sheet not loaded.
 */
function drawSheetFrame(
  ctx: CanvasRenderingContext2D,
  sf: SheetFrame,
  x: number,
  y: number,
  w: number = TILE_SIZE,
  h: number = TILE_SIZE,
): boolean {
  const sheet = getEnvironmentSheetById(sf.sheetId);
  if (!sheet) return false;
  // w=0 / h=0 are sentinels meaning "full image" (used by 48×48 Singles)
  const srcW = sf.frame.w === 0 ? sheet.naturalWidth  : sf.frame.w;
  const srcH = sf.frame.h === 0 ? sheet.naturalHeight : sf.frame.h;
  const dstW = sf.frame.w === 0 ? sheet.naturalWidth  : w;
  const dstH = sf.frame.h === 0 ? sheet.naturalHeight : h;
  ctx.drawImage(sheet, sf.frame.x, sf.frame.y, srcW, srcH, x, y, dstW, dstH);
  return true;
}

// ── Individual Item Rendering (for Y-sort) ──────────────────────────────────

/**
 * Renders a single furniture item at world coordinates.
 * Uses atlasKey for LimeZu multi-sheet rendering with fallback to colored rectangles.
 * Called by buildRenderables via callback.
 */
function renderFurnitureItemWorld(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
): void {
  const x = item.col * TILE_SIZE;
  const y = item.row * TILE_SIZE;
  const rotation = item.rotation ?? 0;

  // Try atlas key first — use sprite's native dimensions
  if (item.atlasKey) {
    const sf = LIMEZU_ATLAS[item.atlasKey];
    if (sf) {
      const sheet = getEnvironmentSheetById(sf.sheetId);
      // Resolve actual draw dimensions (handle w=0/h=0 full-image sentinel)
      const drawW = sf.frame.w === 0 ? (sheet?.naturalWidth  ?? item.width  * TILE_SIZE) : sf.frame.w;
      const drawH = sf.frame.h === 0 ? (sheet?.naturalHeight ?? item.height * TILE_SIZE) : sf.frame.h;
      if (rotation !== 0) {
        // Rotate around the center of the item's tile footprint
        const cx = x + (item.width * TILE_SIZE) / 2;
        const cy = y + (item.height * TILE_SIZE) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-drawW / 2, -drawH / 2);
        drawSheetFrame(ctx, sf, 0, 0, drawW, drawH);
        ctx.restore();
      } else {
        drawSheetFrame(ctx, sf, x, y, drawW, drawH);
      }
      return;
    }
  }

  // Fallback: semi-transparent placeholder at footprint size
  const w = item.width * TILE_SIZE;
  const h = item.height * TILE_SIZE;
  ctx.fillStyle = 'rgba(100, 80, 60, 0.4)';
  ctx.fillRect(x, y, w, h);
}

/**
 * Renders a single decoration item at world coordinates.
 * Uses LIMEZU_ATLAS for multi-sheet rendering.
 * Called by buildRenderables via callback.
 */
function renderDecorationWorld(
  ctx: CanvasRenderingContext2D,
  dec: DecorationItem,
): void {
  const x = dec.col * TILE_SIZE;
  const y = dec.row * TILE_SIZE;

  const sf = LIMEZU_ATLAS[dec.key];
  if (!sf) return;
  // Resolve sfFull sentinels (w=0/h=0 → use natural dimensions)
  const sheet = getEnvironmentSheetById(sf.sheetId);
  const drawW = sf.frame.w === 0 ? (sheet?.naturalWidth  ?? 48) : sf.frame.w;
  const drawH = sf.frame.h === 0 ? (sheet?.naturalHeight ?? 48) : sf.frame.h;
  drawSheetFrame(ctx, sf, x, y, drawW, drawH);
}

// ── Drop Zone Highlight ─────────────────────────────────────────────────────

/**
 * Draws amber dashed border on the desk area when dragging files over a valid agent room.
 * Drop zone is drawn in world transform. Invalid-drop tooltip is drawn at screen coords.
 */
export function renderDropZoneHighlight(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  tx: number,
  ty: number,
  canvasWidth: number,
  _canvasHeight: number,
  dpr: number = 1,
): void {
  if (dragOverRoomId) {
    const room = ROOMS.find(r => r.id === dragOverRoomId);
    if (room) {
      // Desk area in world coordinates
      const deskCol = room.seatTile.col;
      const deskRow = room.seatTile.row - 1;
      const deskW = 2;
      const deskH = 1;

      const x = deskCol * TILE_SIZE;
      const y = deskRow * TILE_SIZE;
      const w = deskW * TILE_SIZE;
      const h = deskH * TILE_SIZE;

      // Semi-transparent amber fill
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.fillRect(x, y, w, h);

      // Amber dashed border (lineWidth is in world units, scale it)
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 3 / zoom]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }

  if (invalidDropMessage) {
    // Tooltip renders at screen coords — switch to identity
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tooltipX = Math.min(invalidDropX, canvasWidth - 200);
    const tooltipY = Math.max(invalidDropY - 30, 10);

    const text = invalidDropMessage;
    ctx.font = '12px monospace';
    const metrics = ctx.measureText(text);
    const padX = 8;
    const padY = 4;
    const tw = metrics.width + padX * 2;
    const th = 16 + padY * 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tw, th, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tooltipX + padX, tooltipY + th / 2);

    // Restore world transform
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, tx * dpr, ty * dpr);
  }
}

// ── File Icon Rendering ─────────────────────────────────────────────────────

/** Returns the desk rectangle for an agent room (col, row, width, height in tiles) */
export function getDeskRect(room: typeof ROOMS[number]): { col: number; row: number; width: number; height: number } {
  return {
    col: room.seatTile.col,
    row: room.seatTile.row - 1,
    width: 2,
    height: 1,
  };
}

/**
 * Renders file icons on each agent's desk at screen coordinates.
 * Up to 5 icons with "+N" badge for overflow.
 * PDF icons get a red header bar, DOCX get blue.
 */
export function renderFileIcons(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number },
): void {
  const { files } = useFileStore.getState();
  hoveredFileId = null; // Reset each frame

  const tileSize = TILE_SIZE * zoom;

  for (const room of ROOMS) {
    if (!AGENT_ROOM_IDS.has(room.id)) continue;

    const agentFiles = files.filter(f => f.agentId === room.id);
    if (agentFiles.length === 0) continue;

    const desk = getDeskRect(room);
    const deskScreen = worldToScreen(desk.col * TILE_SIZE, desk.row * TILE_SIZE);
    const deskX = Math.floor(deskScreen.x);
    const deskY = Math.floor(deskScreen.y);

    const iconW = Math.floor(tileSize * 0.35);
    const iconH = Math.floor(tileSize * 0.45);

    const visibleFiles = agentFiles.slice(0, 5);

    for (let i = 0; i < visibleFiles.length; i++) {
      const file = visibleFiles[i]!;

      // Deterministic scatter for "messy desk" feel
      const scatterX = ((i * 7 + 3) % 5) - 2;
      const scatterY = ((i * 3 + 1) % 3) - 1;

      const ix = deskX + Math.floor((i % 3) * iconW * 1.3) + scatterX * zoom;
      const iy = deskY + Math.floor(Math.floor(i / 3) * iconH * 1.2) + scatterY * zoom;

      // White paper background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ix, iy, iconW, iconH);

      // Folded corner (top-right triangle)
      const foldSize = Math.max(2, Math.floor(zoom * 2));
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(ix + iconW - foldSize, iy);
      ctx.lineTo(ix + iconW, iy + foldSize);
      ctx.lineTo(ix + iconW, iy);
      ctx.closePath();
      ctx.fill();

      // Header bar: red for PDF, blue for DOCX
      ctx.fillStyle = file.type === 'pdf' ? '#ef4444' : '#3b82f6';
      ctx.fillRect(ix, iy, iconW, Math.max(2, Math.floor(zoom)));

      // Tiny text lines inside for realism
      ctx.fillStyle = '#cccccc';
      const lineH = Math.max(1, Math.floor(zoom * 0.5));
      const lineW = iconW - 4;
      for (let l = 0; l < 3; l++) {
        const ly = iy + Math.floor(zoom) + 2 + l * (lineH + 2);
        if (ly + lineH < iy + iconH - 1) {
          ctx.fillRect(ix + 2, ly, lineW * (l === 2 ? 0.6 : 1), lineH);
        }
      }

      // Border
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 1;
      ctx.strokeRect(ix + 0.5, iy + 0.5, iconW - 1, iconH - 1);

      // Check hover
      if (hoverTileCol >= 0 && hoverTileRow >= 0) {
        const hoverScreen = worldToScreen(hoverTileCol * TILE_SIZE, hoverTileRow * TILE_SIZE);
        const hoverX = Math.floor(hoverScreen.x);
        const hoverY = Math.floor(hoverScreen.y);
        if (
          hoverX >= ix - tileSize / 2 && hoverX <= ix + iconW + tileSize / 2 &&
          hoverY >= iy - tileSize / 2 && hoverY <= iy + iconH + tileSize / 2
        ) {
          hoveredFileId = file.id;

          // Hover tooltip: filename above icon
          const name = file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name;
          ctx.font = `${Math.max(8, 8 * zoom / 2)}px monospace`;
          const tm = ctx.measureText(name);
          const tpx = 4;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.beginPath();
          ctx.roundRect(ix - tpx, iy - 14 * zoom / 2, tm.width + tpx * 2, 12 * zoom / 2, 3);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, ix, iy - 8 * zoom / 2);
        }
      }
    }

    // "+N" badge if more than 5 files
    if (agentFiles.length > 5) {
      const overflow = agentFiles.length - 5;
      const badgeText = `+${overflow}`;
      const bx = deskX + desk.width * tileSize - Math.floor(tileSize * 0.4);
      const by = deskY + Math.floor(tileSize * 0.1);

      ctx.font = `bold ${Math.max(8, 8 * zoom / 2)}px monospace`;
      const bm = ctx.measureText(badgeText);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bm.width + 6, 12 * zoom / 2, 3);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bx + 3, by + 6 * zoom / 2);
    }
  }
}

// ── Furniture Hover Glow ────────────────────────────────────────────────────

/**
 * Draws a subtle animated glow around interactive furniture (filing cabinets + desks)
 * when the mouse hovers over them. Filing cabinets glow gold, desks glow teal.
 */
function renderFurnitureHoverGlow(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number },
): void {
  if (hoverTileCol < 0 || hoverTileRow < 0) return;

  // Check both the hovered row and row-1 (filing cabinets are visually 2 tiles tall)
  for (const r of [hoverTileRow, hoverTileRow - 1]) {
    const idx = getFurnitureAt(hoverTileCol, r);
    if (idx === null) continue;

    const item = FURNITURE[idx];
    if (!item) continue;

    const isFilingCabinet = item.type === 'filing-cabinet';
    const isDesk = item.type === 'desk' && item.roomId !== 'billy' && item.roomId !== '';

    if (!isFilingCabinet && !isDesk) continue;

    const tileSize = TILE_SIZE * zoom;
    const screen = worldToScreen(item.col * TILE_SIZE, item.row * TILE_SIZE);
    const x = Math.floor(screen.x) - 2;
    const y = Math.floor(screen.y) - 2;
    const w = item.width * tileSize + 4;
    const h = ((item as { height?: number }).height ?? 1) * tileSize + 4;

    // Subtle glow: gold for filing cabinet, teal for desk
    const glowColor = isFilingCabinet ? 'rgba(245, 158, 11, 0.3)' : 'rgba(0, 200, 180, 0.2)';
    const borderColor = isFilingCabinet ? 'rgba(245, 158, 11, 0.6)' : 'rgba(0, 200, 180, 0.45)';

    ctx.save();
    ctx.shadowColor = isFilingCabinet ? '#f59e0b' : '#00c8b4';
    ctx.shadowBlur = 8 * zoom;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
    ctx.restore();

    // Border outline
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.stroke();

    // Tiny label below
    const label = isFilingCabinet ? '🗄️ PERSONA' : '💻 FILES';
    ctx.font = `${Math.max(7, 7 * zoom / 2)}px monospace`;
    const tm = ctx.measureText(label);
    const lx = x + w / 2 - tm.width / 2;
    const ly = y + h + 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(lx - 4, ly - 1, tm.width + 8, 10 * zoom / 2, 3);
    ctx.fill();

    ctx.fillStyle = isFilingCabinet ? '#fbbf24' : '#5eead4';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, lx, ly);

    return; // Only one glow at a time
  }
}

// ── Character Rendering ─────────────────────────────────────────────────────

/**
 * Renders a single character at world coordinates.
 * Called by buildRenderables via callback.
 */
function renderCharacterWorld(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  zoom: number,
  agentStatuses: Record<string, string>,
): void {
  // ch.x, ch.y are already in world pixels — draw directly in world transform
  const x = ch.x;
  const y = ch.y;

  // Foot-center anchor: 32x32 sprite centered horizontally on 16x16 tile, feet at tile bottom
  const drawX = x - (CHAR_SPRITE_W - TILE_SIZE) / 2;  // x - 8 (32x32 on 16x16 grid)
  const drawY = y - (CHAR_SPRITE_H - TILE_SIZE);       // y - 16

  // Drop shadow: dark ellipse at feet (draw before character so sprite overlaps it)
  // Sized for 32x32 Metro City character sprites
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  const shadowCx = x + TILE_SIZE / 2;       // center of tile
  const shadowCy = y + TILE_SIZE - 1;        // just above tile bottom
  const shadowRx = TILE_SIZE * 0.5;          // horizontal radius (fits 32px sprites)
  const shadowRy = TILE_SIZE * 0.15;         // vertical radius (flat ellipse)
  ctx.ellipse(shadowCx, shadowCy, shadowRx, shadowRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Try sprite-based rendering
  const sheet = getCharacterSheet(ch.id);
  if (sheet) {
    let spriteState: 'idle' | 'walk' | 'work' | 'sit' | 'talk' = ch.state;
    const status = agentStatuses[ch.id];
    if (status === 'needs-attention' && ch.state === 'idle') {
      spriteState = 'talk';
    }

    const frames = CHARACTER_FRAMES[spriteState]?.[ch.direction];
    if (frames && frames.length > 0) {
      const frameIdx = Math.min(ch.frame, frames.length - 1);
      const frame = frames[frameIdx]!;
      ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, drawX, drawY, CHAR_SPRITE_W, CHAR_SPRITE_H);
      return;
    }
  }

  // Fallback: colored rectangle at 32x32 with foot-center anchor
  const padX = CHAR_SPRITE_W * 0.1;
  const padY = CHAR_SPRITE_H * 0.1;

  const color = PLACEHOLDER_COLORS[ch.id] ?? '#888888';
  ctx.fillStyle = color;
  ctx.fillRect(drawX + padX, drawY + padY, CHAR_SPRITE_W - padX * 2, CHAR_SPRITE_H - padY * 2);

  // Direction indicator: small triangle
  ctx.fillStyle = '#ffffff';
  const cx = drawX + CHAR_SPRITE_W / 2;
  const cy = drawY + CHAR_SPRITE_H / 2;
  const indicatorSize = Math.max(2 / zoom, 2);

  ctx.beginPath();
  switch (ch.direction) {
    case 'up':
      ctx.moveTo(cx, cy - indicatorSize);
      ctx.lineTo(cx - indicatorSize, cy + indicatorSize);
      ctx.lineTo(cx + indicatorSize, cy + indicatorSize);
      break;
    case 'down':
      ctx.moveTo(cx, cy + indicatorSize);
      ctx.lineTo(cx - indicatorSize, cy - indicatorSize);
      ctx.lineTo(cx + indicatorSize, cy - indicatorSize);
      break;
    case 'left':
      ctx.moveTo(cx - indicatorSize, cy);
      ctx.lineTo(cx + indicatorSize, cy - indicatorSize);
      ctx.lineTo(cx + indicatorSize, cy + indicatorSize);
      break;
    case 'right':
      ctx.moveTo(cx + indicatorSize, cy);
      ctx.lineTo(cx - indicatorSize, cy - indicatorSize);
      ctx.lineTo(cx - indicatorSize, cy + indicatorSize);
      break;
  }
  ctx.closePath();
  ctx.fill();
}

// ── Status Overlays (LimeZu emote + speech bubble sprites) ──────────────────

function renderStatusOverlays(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  agentStatuses: Record<string, string>,
  zoom: number,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number },
): void {
  for (const ch of characters) {
    if (ch.id === 'billy') continue;
    const status = agentStatuses[ch.id];

    if (status === 'needs-attention') {
      // Speech bubble sprite above character head (screen coordinates)
      // Visual top of Metro City 32×32 character head is ~16px above tile
      const bubbleSf = LIMEZU_ATLAS['speech-bubble-left'];
      if (bubbleSf) {
        const sheet = getEnvironmentSheetById(bubbleSf.sheetId);
        if (sheet) {
          const charScreen = worldToScreen(ch.x + TILE_SIZE / 2, ch.y - 16);
          const cx = Math.floor(charScreen.x);
          // Speech bubble is 2x2 tiles (32x32 in source). Scale by zoom * 0.8 for visual balance.
          const size = 16 * zoom * 0.8;
          const spriteCanvas = getCachedSprite(sheet, bubbleSf.frame, zoom);
          const drawX = cx - size;
          const drawY = Math.floor(charScreen.y - size * 2 - 2 * zoom);
          ctx.drawImage(spriteCanvas, drawX, drawY, size * 2, size * 2);

          // Red notification dot on top-right of speech bubble (functional indicator)
          ctx.fillStyle = '#f87171';
          const dotR = Math.max(1, Math.floor(zoom * 0.8));
          ctx.beginPath();
          ctx.arc(drawX + size * 2 - dotR, drawY + dotR + 1, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (status === 'thinking') {
      // Thinking emote sprite above character head (screen coordinates)
      // Visual top of Metro City character head is ~16px above tile
      const emoteSf = LIMEZU_ATLAS['emote-thinking'];
      if (emoteSf) {
        const sheet = getEnvironmentSheetById(emoteSf.sheetId);
        if (sheet) {
          const charScreen = worldToScreen(ch.x + TILE_SIZE / 2, ch.y - 16);
          const cx = Math.floor(charScreen.x);
          // Emote is 16x16. Scale by zoom * 0.8 (slightly smaller than a full tile)
          const size = 16 * zoom * 0.8;
          const spriteCanvas = getCachedSprite(sheet, emoteSf.frame, zoom);
          ctx.drawImage(spriteCanvas, cx - size / 2, Math.floor(charScreen.y - size - 2 * zoom), size, size);
        }
      }
    } else if (stretchingAgents.has(ch.id)) {
      // LimeZu stretch emote sprite above character head during stretch phase
      // Mutually exclusive with thinking emote (else if)
      const stretchSf = LIMEZU_ATLAS['emote-stretch'];
      if (stretchSf) {
        const sheet = getEnvironmentSheetById(stretchSf.sheetId);
        if (sheet) {
          const charScreen = worldToScreen(ch.x + TILE_SIZE / 2, ch.y - 16);
          const cx = Math.floor(charScreen.x);
          // Emote is 16x16. Scale by zoom * 0.8 (slightly smaller than a full tile)
          const size = 16 * zoom * 0.8;
          const spriteCanvas = getCachedSprite(sheet, stretchSf.frame, zoom);
          ctx.drawImage(spriteCanvas, cx - size / 2, Math.floor(charScreen.y - size - 2 * zoom), size, size);
        }
      }
    }

    // Collaboration indicator: blue dot above agent head when actively processing a hop.
    // Distinct from amber thinking emote — renders independently (can co-exist).
    if (collaboratingAgents.has(ch.id)) {
      const charScreen = worldToScreen(ch.x + TILE_SIZE / 2, ch.y - 16);
      const cx = Math.floor(charScreen.x);
      const cy = Math.floor(charScreen.y);
      const dotR = Math.max(3, Math.floor(zoom * 2.5));
      // Offset to the right of where emote would appear to avoid overlap
      const dotX = cx + Math.floor(zoom * 6);
      const dotY = cy - Math.floor(zoom * 4);

      ctx.save();
      // Blue circle
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
      // White chain symbol inside dot
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(6, Math.floor(zoom * 6))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⛓', dotX, dotY + 1);
      ctx.restore();
    }
  }
}

// ── Hover Name Tooltip ────────────────────────────────────────────────────────

/**
 * When the cursor is over a character's tile, renders their name in a small
 * tooltip above their sprite.
 */
function renderHoverTooltip(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  zoom: number,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number },
): void {
  if (hoverTileCol < 0 || hoverTileRow < 0) return;

  for (const ch of characters) {
    if (ch.tileCol !== hoverTileCol || ch.tileRow !== hoverTileRow) continue;

    const name = ch.id === 'billy' ? 'Billy' : (getAgent(ch.id)?.name ?? ch.id);

    // Position: horizontally centered on the character, above the sprite head
    const screen = worldToScreen(ch.x + TILE_SIZE / 2, ch.y - 14);
    const x = Math.floor(screen.x);
    const y = Math.floor(screen.y);

    const fontSize = Math.max(9, 10 * zoom);
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const metrics = ctx.measureText(name);
    const padX = 5 * zoom;
    const padY = 3 * zoom;

    // Tooltip background
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    const bgX = x - metrics.width / 2 - padX;
    const bgY = y - fontSize - padY;
    const bgW = metrics.width + padX * 2;
    const bgH = fontSize + padY * 2;
    const r = 3 * zoom;
    ctx.beginPath();
    ctx.moveTo(bgX + r, bgY);
    ctx.lineTo(bgX + bgW - r, bgY);
    ctx.arcTo(bgX + bgW, bgY, bgX + bgW, bgY + r, r);
    ctx.lineTo(bgX + bgW, bgY + bgH - r);
    ctx.arcTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH, r);
    ctx.lineTo(bgX + r, bgY + bgH);
    ctx.arcTo(bgX, bgY + bgH, bgX, bgY + bgH - r, r);
    ctx.lineTo(bgX, bgY + r);
    ctx.arcTo(bgX, bgY, bgX + r, bgY, r);
    ctx.closePath();
    ctx.fill();

    // Name text in agent color (or white for billy)
    const color = ch.id === 'billy' ? '#ffffff' : (getAgent(ch.id)?.color ?? '#ffffff');
    ctx.fillStyle = color;
    ctx.fillText(name, x, y);

    break; // only one character per tile
  }
}

