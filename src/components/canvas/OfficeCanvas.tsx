import { useRef, useEffect, useCallback } from 'react';
import { useOfficeStore } from '@/store/officeStore';
import { useEditorStore } from '@/store/editorStore';
import { startGameLoop } from '@/engine/gameLoop';
import { setupInputHandlers } from '@/engine/input';
import { loadAllAssets } from '@/engine/spriteSheet';
import { TILE_SIZE } from '@/engine/types';
import { OFFICE_TILE_MAP } from '@/engine/officeLayout';
import { customPieceSrc, customPieceWorldSize, assembledWorldSize, hitTestDecoration } from '@/engine/decorationOverlay';

/**
 * Pixel-Art Office Canvas — powered by the full game engine.
 *
 * On mount:
 *   1. Initializes all 7 characters (Billy + 6 agents) in the store
 *   2. Starts the game loop immediately (shows fallback colors while sprites load)
 *   3. Attaches input handlers (click-to-walk, zoom, drag-pan, keyboard, D&D)
 *   4. Loads all sprite sheets in background (renderer auto-upgrades on load)
 *
 * In Decorate Mode: the canvas also handles HTML5 drag-over / drop events
 * from the furniture catalog panel — dropping a piece creates a PlacedDecoration
 * at the snapped world position.
 *
 * Supports two drag sources:
 *  • Atlas pieces from Office Catalog (decorDragDef)
 *  • Composer-defined pieces from My Pieces tab (decorDragCustomDef)
 *
 * In Decorate Mode, mouse-dragging an already-placed piece moves it.
 */
export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── World-position helpers ───────────────────────────────────────────────

  /** Convert CSS mouse position to raw (un-snapped) world pixel position. */
  const cssToRawWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const camera = useOfficeStore.getState().camera;
    const mapCols = OFFICE_TILE_MAP[0]?.length ?? 42;
    const mapRows = OFFICE_TILE_MAP.length;
    const mapWorldW = mapCols * TILE_SIZE;
    const mapWorldH = mapRows * TILE_SIZE;
    const zoom = camera.zoom;
    const tx = (rect.width  - mapWorldW * zoom) / 2 - camera.x;
    const ty = (rect.height - mapWorldH * zoom) / 2 - camera.y;
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    return {
      worldX: (cssX - tx) / zoom,
      worldY: (cssY - ty) / zoom,
    };
  }, []);

  /** Convert CSS mouse position to world pixel position, snapped to tile grid. */
  const cssToSnappedWorld = useCallback((clientX: number, clientY: number) => {
    const raw = cssToRawWorld(clientX, clientY);
    if (!raw) return null;
    return {
      worldX: Math.floor(raw.worldX / TILE_SIZE) * TILE_SIZE,
      worldY: Math.floor(raw.worldY / TILE_SIZE) * TILE_SIZE,
    };
  }, [cssToRawWorld]);

  // ── Drag-and-Drop handlers (Decorate Mode — from catalog panel) ──────────

  const handleDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    const hasDrag = store.decorDragDef || store.decorDragCustomDef;
    if (!store.editorMode || !hasDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const pos = cssToSnappedWorld(e.clientX, e.clientY);
    if (!pos) return;

    const sc = store.decorScaleFactor;

    if (store.decorDragDef) {
      const def = store.decorDragDef;
      store.setDecorGhostState({ kind: 'atlas', atlasKey48: def.atlasKey48,
        worldX: pos.worldX, worldY: pos.worldY,
        worldW: def.defaultW * TILE_SIZE * sc, worldH: def.defaultH * TILE_SIZE * sc });
    } else if (store.decorDragCustomDef) {
      const piece = store.decorDragCustomDef;
      if (piece.kind === 'assembled') {
        const { w, h } = assembledWorldSize(piece);
        store.setDecorGhostState({ kind: 'assembled', placements: piece.placements,
          worldX: pos.worldX, worldY: pos.worldY, worldW: w * sc, worldH: h * sc });
      } else {
        const { w, h } = customPieceWorldSize(piece);
        const src = customPieceSrc(piece);
        store.setDecorGhostState({ kind: 'custom', sheetId: piece.sheetId,
          srcX: src.x, srcY: src.y, srcW: src.w, srcH: src.h,
          worldX: pos.worldX, worldY: pos.worldY, worldW: w * sc, worldH: h * sc });
      }
    }
  }, [cssToSnappedWorld]);

  const handleDragLeave = useCallback(() => {
    useEditorStore.getState().setDecorGhostState(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const store = useEditorStore.getState();
    if (!store.editorMode) return;

    const pos = cssToSnappedWorld(e.clientX, e.clientY);
    if (!pos) return;

    const sc = store.decorScaleFactor;

    if (store.decorDragDef) {
      const def = store.decorDragDef;
      const dec = { id: crypto.randomUUID(), kind: 'atlas' as const,
        atlasKey48: def.atlasKey48, worldX: pos.worldX, worldY: pos.worldY,
        worldW: def.defaultW * TILE_SIZE * sc, worldH: def.defaultH * TILE_SIZE * sc };
      store.addPlacedDecoration(dec);
      store.pushAction({
        description: `Place ${def.atlasKey48}`,
        apply() { store.addPlacedDecoration(dec); },
        revert() { store.removePlacedDecoration(dec.id); },
      });
      store.setDecorDragDef(null);
    } else if (store.decorDragCustomDef) {
      const piece = store.decorDragCustomDef;
      if (piece.kind === 'assembled') {
        const { w, h } = assembledWorldSize(piece);
        const dec = { id: crypto.randomUUID(), kind: 'assembled' as const,
          placements: piece.placements, worldX: pos.worldX, worldY: pos.worldY, worldW: w * sc, worldH: h * sc };
        store.addPlacedDecoration(dec);
        store.pushAction({
          description: `Place assembled piece`,
          apply() { store.addPlacedDecoration(dec); },
          revert() { store.removePlacedDecoration(dec.id); },
        });
      } else {
        const { w, h } = customPieceWorldSize(piece);
        const src = customPieceSrc(piece);
        const dec = { id: crypto.randomUUID(), kind: 'custom' as const,
          sheetId: piece.sheetId, srcX: src.x, srcY: src.y, srcW: src.w, srcH: src.h,
          worldX: pos.worldX, worldY: pos.worldY, worldW: w * sc, worldH: h * sc };
        store.addPlacedDecoration(dec);
        store.pushAction({
          description: `Place custom piece`,
          apply() { store.addPlacedDecoration(dec); },
          revert() { store.removePlacedDecoration(dec.id); },
        });
      }
      store.setDecorDragCustomDef(null);
    }

    store.setDecorGhostState(null);
  }, [cssToSnappedWorld]);


  // Right-click on canvas in Decorate Mode: remove placed decoration at cursor
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    if (!store.editorMode) return;
    if (store.placedDecorations.length === 0) return;
    e.preventDefault();
    const pos = cssToSnappedWorld(e.clientX, e.clientY);
    if (!pos) return;
    store.removeDecorationAtWorld(pos.worldX, pos.worldY);
  }, [cssToSnappedWorld]);

  // ── Mouse drag-to-move handlers (Decorate Mode — move placed items) ──────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    if (!store.editorMode || e.button !== 0) return;

    // If catalog panel is currently dragging, don't intercept
    if (store.decorDragDef || store.decorDragCustomDef) return;

    const raw = cssToRawWorld(e.clientX, e.clientY);
    const snapped = cssToSnappedWorld(e.clientX, e.clientY);
    if (!raw || !snapped) return;

    // Hit-test placed decorations (topmost wins)
    const hitId = hitTestDecoration(store.placedDecorations, raw.worldX, raw.worldY);
    if (!hitId) return;

    const dec = store.placedDecorations.find((d) => d.id === hitId);
    if (!dec) return;

    e.preventDefault();
    e.stopPropagation();

    // Record grab offset (cursor pos - item top-left), snapped to tile
    const grabOffsetX = snapped.worldX - dec.worldX;
    const grabOffsetY = snapped.worldY - dec.worldY;

    // Remove from placed list while dragging (it will be shown as a ghost)
    store.removePlacedDecoration(hitId);
    store.setDecorMoveDrag({ dec, grabOffsetX, grabOffsetY });

    // Show ghost at current position
    store.setDecorGhostState({
      kind: dec.kind,
      atlasKey48: dec.atlasKey48,
      sheetId: dec.sheetId, srcX: dec.srcX, srcY: dec.srcY, srcW: dec.srcW, srcH: dec.srcH,
      placements: dec.placements,
      worldX: dec.worldX, worldY: dec.worldY, worldW: dec.worldW, worldH: dec.worldH,
    });
  }, [cssToRawWorld, cssToSnappedWorld]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    if (!store.editorMode || !store.decorMoveDrag) return;

    const snapped = cssToSnappedWorld(e.clientX, e.clientY);
    if (!snapped) return;

    const { dec, grabOffsetX, grabOffsetY } = store.decorMoveDrag;
    const newX = snapped.worldX - grabOffsetX;
    const newY = snapped.worldY - grabOffsetY;

    store.setDecorGhostState({
      kind: dec.kind,
      atlasKey48: dec.atlasKey48,
      sheetId: dec.sheetId, srcX: dec.srcX, srcY: dec.srcY, srcW: dec.srcW, srcH: dec.srcH,
      placements: dec.placements,
      worldX: newX, worldY: newY, worldW: dec.worldW, worldH: dec.worldH,
    });
  }, [cssToSnappedWorld]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    if (!store.editorMode || !store.decorMoveDrag) return;

    const snapped = cssToSnappedWorld(e.clientX, e.clientY);
    const { dec, grabOffsetX, grabOffsetY } = store.decorMoveDrag;

    const newX = snapped ? snapped.worldX - grabOffsetX : dec.worldX;
    const newY = snapped ? snapped.worldY - grabOffsetY : dec.worldY;

    // Place the item at the new position
    store.addPlacedDecoration({ ...dec, worldX: newX, worldY: newY });
    store.setDecorMoveDrag(null);
    store.setDecorGhostState(null);
  }, [cssToSnappedWorld]);

  // Cancel move drag if mouse leaves canvas
  const handleMouseLeave = useCallback(() => {
    const store = useEditorStore.getState();
    if (!store.editorMode || !store.decorMoveDrag) return;
    // Put item back at original position
    const { dec } = store.decorMoveDrag;
    store.addPlacedDecoration(dec);
    store.setDecorMoveDrag(null);
    store.setDecorGhostState(null);
  }, []);

  // ── Game Loop Setup ──────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Initialize characters (Billy + agents) in the store BEFORE game loop
    //    so the first rendered frame shows characters
    const state = useOfficeStore.getState();
    if (state.characters.length === 0) {
      state.initializeCharacters();
    }

    // 2. Start the game loop immediately — it renders fallback colored
    //    rectangles until sprite sheets finish loading
    const stopGameLoop = startGameLoop(canvas);

    // 3. Attach input handlers — click-to-walk, keyboard navigation,
    //    drag-to-pan, pinch/wheel zoom, file drag-and-drop
    const removeInput = setupInputHandlers(canvas);

    // 4. Load all sprite sheets in the background
    //    The renderer auto-upgrades to sprites when getCharacterSheet() stops returning null
    void loadAllAssets();

    return () => {
      removeInput();
      stopGameLoop();
    };
  }, []);

  return (
    <canvas
      data-testid="office-canvas"
      ref={canvasRef}
      id="office-canvas"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        display: 'block',
        outline: 'none',
        cursor: 'default',
      }}
    />
  );
}


