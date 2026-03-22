/**
 * Editor-mode input handlers for the layout editor.
 *
 * When editor mode is active, these handlers intercept canvas clicks
 * and keyboard events to paint tiles, place furniture, etc.
 */
import { useEditorStore } from '@/store/editorStore';
import { useOfficeStore } from '@/store/officeStore';
import { screenToTile } from './camera';
import { setTile, addFurniture, removeFurnitureAt, getFurnitureAt, OFFICE_TILE_MAP, FURNITURE, ROOMS, setTileStyle, clearTileStyle, getTileStyle, rotateFurnitureAt } from './officeLayout';
import type { FurnitureItem } from './officeLayout';
import { TileType } from './types';
import type { EditorAction } from '@/store/editorStore';
import { saveLayoutToIDB } from './layoutSerializer';

// ── Room Templates ───────────────────────────────────────────────────────────

export interface RoomTemplate {
  id: string;
  label: string;
  width: number;
  height: number;
  kind: 'room-clone' | 'generic';
  roomId?: string;
  tiles?: number[];  // row-major TileType values; only for generic kind
}

function buildRoomTiles(w: number, h: number): number[] {
  const tiles: number[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const isEdge = r === 0 || r === h - 1 || c === 0 || c === w - 1;
      tiles.push(isEdge ? TileType.WALL : TileType.FLOOR);
    }
  }
  return tiles;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  // Room clones — snapshot from ROOMS at stamp time
  { id: 'clone-isaac',  label: "Isaac's Office",   kind: 'room-clone', roomId: 'isaac',   width: 0, height: 0 },
  { id: 'clone-billy',  label: "BILLY's Office",   kind: 'room-clone', roomId: 'billy',   width: 0, height: 0 },
  { id: 'clone-patrik', label: "Patrik's Office",  kind: 'room-clone', roomId: 'patrik',  width: 0, height: 0 },
  { id: 'clone-marcos', label: "Marcos's Office",  kind: 'room-clone', roomId: 'marcos',  width: 0, height: 0 },
  { id: 'clone-sandra', label: "Sandra's Office",  kind: 'room-clone', roomId: 'sandra',  width: 0, height: 0 },
  { id: 'clone-wendy',  label: "Wendy's Office",   kind: 'room-clone', roomId: 'wendy',   width: 0, height: 0 },
  // Generic shapes — floor tiles + walls on perimeter
  { id: 'small-office',  label: 'Small Office (3×4)',  kind: 'generic', width: 3, height: 4, tiles: buildRoomTiles(3, 4) },
  { id: 'meeting-room',  label: 'Meeting Room (5×5)',  kind: 'generic', width: 5, height: 5, tiles: buildRoomTiles(5, 5) },
  { id: 'open-area',     label: 'Open Area (8×6)',     kind: 'generic', width: 8, height: 6, tiles: buildRoomTiles(8, 6) },
  { id: 'corridor',      label: 'Corridor (2×8)',      kind: 'generic', width: 2, height: 8, tiles: buildRoomTiles(2, 8) },
  { id: 'large-office',  label: 'Large Office (5×6)',  kind: 'generic', width: 5, height: 6, tiles: buildRoomTiles(5, 6) },
];

// ── Drag-paint state ────────────────────────────────────────────────────────

let isPainting = false;
let paintBatch: Array<{ col: number; row: number; oldType: TileType; newType: TileType; oldStyle: string | null; newStyle: string | null }> = [];

// ── Furniture drag-to-move state ────────────────────────────────────────────

let isDraggingFurniture = false;
let dragFurnitureIdx: number | null = null;
let dragStartCol = 0;
let dragStartRow = 0;
let dragOrigCol = 0;
let dragOrigRow = 0;
let dragMouseStartX = 0;
let dragMouseStartY = 0;
let dragDidMove = false; // true once the mouse moves beyond a dead zone

// ── Setup ───────────────────────────────────────────────────────────────────

/**
 * Sets up editor-specific input handlers on the canvas.
 * Returns a cleanup function. Only active when editorMode is true.
 */
export function setupEditorInputHandlers(canvas: HTMLCanvasElement): () => void {

  function getClickTile(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const state = useOfficeStore.getState();
    return screenToTile(cssX, cssY, state.camera, rect.width, rect.height);
  }

  function handleMouseDown(e: MouseEvent): void {
    if (!useEditorStore.getState().editorMode) return;

    const tile = getClickTile(e);
    if (!tile) return;

    // Right-click on any tool: delete furniture at the clicked tile immediately
    if (e.button === 2) {
      e.preventDefault();
      const idx = getFurnitureAt(tile.col, tile.row);
      if (idx !== null) {
        const item = FURNITURE[idx]!;
        const action: EditorAction = {
          description: `Remove ${item.atlasKey ?? item.type}`,
          apply() { removeFurnitureAt(idx); },
          revert() { addFurniture(item, idx); },
        };
        action.apply();
        useEditorStore.getState().pushAction(action);
        useEditorStore.getState().setSelectedCanvasFurniture(null);
      }
      return;
    }

    if (e.button !== 0) return;

    const { activeTool } = useEditorStore.getState();

    if (activeTool === 'wall' || activeTool === 'floor' || activeTool === 'eraser') {
      isPainting = true;
      paintBatch = [];
      applyPaintAt(tile.col, tile.row, activeTool);
    } else if (activeTool === 'door') {
      applyDoor(tile.col, tile.row);
    } else if (activeTool === 'furniture') {
      handleFurniturePlacement(tile.col, tile.row);
    } else if (activeTool === 'select') {
      // Start drag if clicking on existing furniture
      const idx = getFurnitureAt(tile.col, tile.row);
      useEditorStore.getState().setSelectedCanvasFurniture(idx);
      if (idx !== null) {
        const item = FURNITURE[idx]!;
        isDraggingFurniture = true;
        dragFurnitureIdx = idx;
        dragStartCol = tile.col;
        dragStartRow = tile.row;
        dragOrigCol = item.col;
        dragOrigRow = item.row;
        dragMouseStartX = e.clientX;
        dragMouseStartY = e.clientY;
        dragDidMove = false;
        canvas.style.cursor = 'grabbing';
      }
    } else if (activeTool === 'eyedropper') {
      handleEyedropper(tile.col, tile.row);
    } else if (activeTool === 'room-template') {
      handleRoomTemplateClick(tile.col, tile.row);
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!useEditorStore.getState().editorMode) return;

    // Furniture drag-to-move
    if (isDraggingFurniture && dragFurnitureIdx !== null) {
      // Dead zone: 3px before committing to a drag (prevents jitter on click)
      if (!dragDidMove) {
        const dx = Math.abs(e.clientX - dragMouseStartX);
        const dy = Math.abs(e.clientY - dragMouseStartY);
        if (dx < 3 && dy < 3) return;
        dragDidMove = true;
      }
      const tile = getClickTile(e);
      if (!tile) return;
      const deltaCol = tile.col - dragStartCol;
      const deltaRow = tile.row - dragStartRow;
      const item = FURNITURE[dragFurnitureIdx];
      if (item) {
        item.col = dragOrigCol + deltaCol;
        item.row = dragOrigRow + deltaRow;
      }
      return;
    }

    if (!isPainting) return;

    const tile = getClickTile(e);
    if (!tile) return;

    const { activeTool } = useEditorStore.getState();
    if (activeTool === 'wall' || activeTool === 'floor' || activeTool === 'eraser') {
      applyPaintAt(tile.col, tile.row, activeTool);
    }
  }

  function handleMouseUp(_e: MouseEvent): void {
    // Commit furniture drag-move as an undo action
    if (isDraggingFurniture && dragFurnitureIdx !== null) {
      canvas.style.cursor = '';
      const idx = dragFurnitureIdx;
      const item = FURNITURE[idx];
      if (item && dragDidMove) {
        const finalCol = item.col;
        const finalRow = item.row;
        const origCol = dragOrigCol;
        const origRow = dragOrigRow;
        const action: EditorAction = {
          description: `Move ${item.atlasKey ?? item.type} to (${finalCol},${finalRow})`,
          apply() { item.col = finalCol; item.row = finalRow; },
          revert() { item.col = origCol; item.row = origRow; },
        };
        useEditorStore.getState().pushAction(action);
      }
      isDraggingFurniture = false;
      dragFurnitureIdx = null;
      dragDidMove = false;
      return;
    }

    if (!isPainting) return;
    isPainting = false;

    // Commit drag-paint batch as a single undo action
    if (paintBatch.length > 0) {
      const batch = [...paintBatch];
      const action: EditorAction = {
        description: `Paint ${batch.length} tiles`,
        apply() {
          for (const { col, row, newType, newStyle } of batch) {
            setTile(col, row, newType);
            if (newStyle) setTileStyle(col, row, newStyle);
            else clearTileStyle(col, row);
          }
        },
        revert() {
          for (const { col, row, oldType, oldStyle } of batch) {
            setTile(col, row, oldType);
            if (oldStyle) setTileStyle(col, row, oldStyle);
            else clearTileStyle(col, row);
          }
        },
      };
      useEditorStore.getState().pushAction(action);
      paintBatch = [];
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!useEditorStore.getState().editorMode) return;

    // Don't intercept when typing in inputs
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;

    const store = useEditorStore.getState();

    // Tool shortcuts
    const toolKeys: Record<string, Parameters<typeof store.setActiveTool>[0]> = {
      'v': 'select',
      'w': 'wall',
      'f': 'floor',
      'd': 'door',
      'e': 'eraser',
      'i': 'eyedropper',
      'r': 'room-template',
      'g': 'grid-resize',
      ' ': 'furniture',
    };

    const tool = toolKeys[e.key.toLowerCase()];
    if (tool) {
      e.preventDefault();
      store.setActiveTool(tool);
      return;
    }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      store.redo();
      return;
    }

    // Confirm room-template ghost preview with Enter
    if (e.key === 'Enter' && store.activeTool === 'room-template') {
      const ghost = store.ghostPreviewTile;
      const tmplId = store.selectedRoomTemplate;
      if (ghost && tmplId) {
        e.preventDefault();
        stampTemplate(tmplId, ghost.col, ghost.row);
        store.setGhostPreviewTile(null);
      }
      return;
    }

    // Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void saveLayoutToIDB();
      return;
    }

    // Exit editor
    if (e.key === 'Escape') {
      e.preventDefault();
      store.setEditorMode(false);
      return;
    }

    // Delete selected furniture
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedFurniture();
      return;
    }

    // Rotate selected furniture 90° clockwise
    if (e.key === ']') {
      e.preventDefault();
      rotateSelectedFurniture();
      return;
    }
  }

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('keydown', handleKeyDown);

  return () => {
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('keydown', handleKeyDown);
  };
}

// ── Exported Actions (callable from UI buttons) ─────────────────────────────

export function deleteSelectedFurniture(): void {
  const store = useEditorStore.getState();
  const idx = store.selectedCanvasFurnitureIdx;
  if (idx === null || idx < 0 || idx >= FURNITURE.length) return;
  const item = FURNITURE[idx]!;
  const action: EditorAction = {
    description: `Remove ${item.atlasKey ?? item.type}`,
    apply() { removeFurnitureAt(idx); },
    revert() { addFurniture(item, idx); },
  };
  action.apply();
  store.pushAction(action);
  store.setSelectedCanvasFurniture(null);
}

export function rotateSelectedFurniture(): void {
  const store = useEditorStore.getState();
  const idx = store.selectedCanvasFurnitureIdx;
  if (idx === null || idx < 0 || idx >= FURNITURE.length) return;
  const item = FURNITURE[idx]!;
  const prevRotation = item.rotation ?? 0;
  const nextRotation = rotateFurnitureAt(idx);
  const action: EditorAction = {
    description: `Rotate ${item.atlasKey ?? item.type} ${nextRotation}°`,
    apply() { item.rotation = nextRotation; },
    revert() { item.rotation = prevRotation; },
  };
  store.pushAction(action);
}

// ── Tool Implementations ────────────────────────────────────────────────────

function applyPaintAt(col: number, row: number, tool: 'wall' | 'floor' | 'eraser'): void {
  const mapRows = OFFICE_TILE_MAP.length;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  if (col < 0 || col >= mapCols || row < 0 || row >= mapRows) return;

  const oldType = OFFICE_TILE_MAP[row]![col]!;
  const oldStyle = getTileStyle(col, row);
  let newType: TileType;
  let newStyle: string | null = null;

  const store = useEditorStore.getState();

  if (tool === 'wall') {
    newType = TileType.WALL;
    newStyle = store.selectedWallStyle;
  } else if (tool === 'floor') {
    newType = TileType.FLOOR;
    newStyle = store.selectedFloorStyle;
  } else {
    // eraser: revert to floor, clear custom style
    newType = TileType.FLOOR;
    newStyle = null;
  }

  // Skip if same type AND same style
  if (oldType === newType && oldStyle === newStyle) return;

  // Check if already in this batch (avoid duplicates during drag)
  if (paintBatch.some((b) => b.col === col && b.row === row)) return;

  setTile(col, row, newType);
  if (newStyle) setTileStyle(col, row, newStyle);
  else clearTileStyle(col, row);

  paintBatch.push({ col, row, oldType, newType, oldStyle, newStyle });
}

function applyDoor(col: number, row: number): void {
  const mapRows = OFFICE_TILE_MAP.length;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  if (col < 0 || col >= mapCols || row < 0 || row >= mapRows) return;

  const oldType = OFFICE_TILE_MAP[row]![col]!;

  // Doors can only be placed on walls
  if (oldType !== TileType.WALL) return;

  const newType = TileType.DOOR;
  setTile(col, row, newType);

  const action: EditorAction = {
    description: 'Place door',
    apply() { setTile(col, row, newType); },
    revert() { setTile(col, row, oldType); },
  };
  useEditorStore.getState().pushAction(action);
}

function handleSelect(col: number, row: number): void {
  // Check if clicking on furniture
  const idx = getFurnitureAt(col, row);
  useEditorStore.getState().setSelectedCanvasFurniture(idx);
}

function handleFurniturePlacement(col: number, row: number): void {
  const store = useEditorStore.getState();
  const furnitureId = store.selectedFurnitureId;
  if (!furnitureId) return; // No furniture selected in catalog

  // Use selected type/size from editorStore; fall back to furnitureId as atlasKey if no override
  const atlasKey = store.selectedFurnitureAtlasKey.trim() || furnitureId;
  const item: FurnitureItem = {
    roomId: '',
    type: store.selectedFurnitureType,
    col,
    row,
    width: store.selectedFurnitureSize.width,
    height: store.selectedFurnitureSize.height,
    atlasKey,
  };

  const insertIdx = FURNITURE.length;
  addFurniture(item);

  const action: EditorAction = {
    description: `Place ${atlasKey} (${item.width}x${item.height} ${item.type})`,
    apply() { addFurniture(item, insertIdx); },
    revert() { removeFurnitureAt(insertIdx); },
  };
  store.pushAction(action);
}

function handleEyedropper(col: number, row: number): void {
  const mapRows = OFFICE_TILE_MAP.length;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  if (col < 0 || col >= mapCols || row < 0 || row >= mapRows) return;

  const tileType = OFFICE_TILE_MAP[row]![col]!;
  const store = useEditorStore.getState();

  if (tileType === TileType.WALL) {
    store.setActiveTool('wall');
  } else if (tileType === TileType.DOOR) {
    store.setActiveTool('door');
  } else {
    store.setActiveTool('floor');
  }
}

function handleRoomTemplateClick(col: number, row: number): void {
  const store = useEditorStore.getState();
  const templateId = store.selectedRoomTemplate;
  if (!templateId) return; // No template armed — click does nothing

  const ghostTile = store.ghostPreviewTile;

  if (!ghostTile) {
    // First click: arm ghost preview at clicked tile
    store.setGhostPreviewTile({ col, row });
  } else {
    // Second click: stamp at ghost position
    stampTemplate(templateId, ghostTile.col, ghostTile.row);
    store.setGhostPreviewTile(null); // Clear after stamp
  }
}

function stampTemplate(templateId: string, col: number, row: number): void {
  const store = useEditorStore.getState();
  const template = ROOM_TEMPLATES.find(t => t.id === templateId);
  if (!template) return;

  // Resolve dimensions for room-clone
  let w = template.width;
  let h = template.height;
  let sourceTiles: number[] | undefined = template.tiles;
  const cloneFurniture: FurnitureItem[] = [];

  if (template.kind === 'room-clone' && template.roomId) {
    const sourceRoom = ROOMS.find(r => r.id === template.roomId);
    if (!sourceRoom) return;
    w = sourceRoom.tileRect.width;
    h = sourceRoom.tileRect.height;
    const srcCol = sourceRoom.tileRect.col;
    const srcRow = sourceRoom.tileRect.row;
    const snapshotTiles: number[] = [];
    for (let dr = 0; dr < h; dr++) {
      for (let dc = 0; dc < w; dc++) {
        const tile = OFFICE_TILE_MAP[srcRow + dr]?.[srcCol + dc] ?? TileType.FLOOR;
        snapshotTiles.push(tile);
      }
    }
    sourceTiles = snapshotTiles;
    // Snapshot furniture items within the source room's bounding box
    for (const f of FURNITURE) {
      if (f.col >= srcCol && f.col < srcCol + w && f.row >= srcRow && f.row < srcRow + h) {
        cloneFurniture.push({
          ...f,
          roomId: '',
          col: col + (f.col - srcCol),
          row: row + (f.row - srcRow),
        });
      }
    }
  }

  if (!sourceTiles) return;

  // Snapshot old tiles for undo
  const oldTiles: { col: number; row: number; type: number }[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const tc = col + dc;
      const tr = row + dr;
      oldTiles.push({ col: tc, row: tr, type: OFFICE_TILE_MAP[tr]?.[tc] ?? TileType.FLOOR });
    }
  }
  const newFurnitureStart = FURNITURE.length;
  const templateLabel = template.label;
  const capturedSourceTiles = sourceTiles;
  const capturedCloneFurniture = cloneFurniture;

  const action: EditorAction = {
    description: `Stamp template: ${templateLabel}`,
    apply() {
      // Set tiles
      for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          const tileType = capturedSourceTiles[dr * w + dc]!;
          setTile(col + dc, row + dr, tileType as TileType);
        }
      }
      // Add furniture (room-clone only)
      for (const f of capturedCloneFurniture) {
        addFurniture(f);
      }
    },
    revert() {
      // Restore old tiles
      for (const { col: tc, row: tr, type } of oldTiles) {
        setTile(tc, tr, type as TileType);
      }
      // Remove added furniture (reverse order)
      for (let i = FURNITURE.length - 1; i >= newFurnitureStart; i--) {
        removeFurnitureAt(i);
      }
    },
  };

  action.apply();
  store.pushAction(action);
}
