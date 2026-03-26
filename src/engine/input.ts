/**
 * Canvas input handling for room click navigation, zoom toggle, hover tracking,
 * drag-and-drop file upload, and file icon click detection.
 *
 * Attaches event listeners to the canvas element. On click, converts screen
 * coordinates to tile coordinates and triggers BILLY walking to the clicked room.
 * Zoom toggles between overview (1) and follow (2) via keyboard 'z' or double-click.
 * Drag-and-drop routes PDF/DOCX files to the agent under the cursor.
 */
import { useOfficeStore } from '@/store/officeStore';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
import { screenToTile, computeAutoFitZoom } from './camera';
import { getRoomAtTile, ROOMS, OFFICE_TILE_MAP, getFurnitureAt, FURNITURE } from './officeLayout';
import { startWalk } from './characters';
import { WALK_SPEED, ZOOM_OVERVIEW_THRESHOLD } from './types';
import { isWalkable } from './tileMap';
import {
  createZoomState,
  onZoomInput,
  startAnimatedZoom,
  nearestHalf,
  MAX_ZOOM,
} from './zoomController';
import type { AgentId } from '@/types/agent';

/** Valid agent room IDs (excludes war-room and billy) */
const AGENT_ROOM_IDS = new Set<string>(['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie']);

/** Valid file extensions for drag-and-drop */
const VALID_EXTENSIONS = new Set(['.pdf', '.docx']);

/** Maps first-letter keys to room IDs for keyboard navigation.
 * P=Patrik, M=Marcos, S=Sandra, I=Isaac, W=Wendy, 6=War Room, B=Billy */
const KEY_TO_ROOM: Record<string, string> = {
  'p': 'patrik',
  'm': 'marcos',
  's': 'sandra',
  'i': 'isaac',
  'w': 'wendy',
  'c': 'charlie',
  '6': 'war-room',
  'b': 'billy',
};

/** Speed walk for keyboard shortcuts: 3.5x normal speed */
const WALK_SPEED_KEYBOARD = WALK_SPEED * 3.5;

/** Module-level cursor screen position for game loop to pass to tickZoom */
export let cursorScreenX = 0;
export let cursorScreenY = 0;

/** Shared zoom state instance -- game loop reads this for tickZoom */
export const zoomState = createZoomState();

/** Whether the user is currently dragging to pan the camera */
export let isDragging = false;

/** Whether the user has manually panned — disables follow until BILLY walks */
export let userHasPanned = false;

/** Called by game loop when BILLY starts walking to re-enable follow */
export function clearUserPan(): void {
  userHasPanned = false;
}

/** Module-level hover position for renderer to read */
export let hoverTileCol = -1;
export let hoverTileRow = -1;

/** Module-level drag state for renderer to read */
export let dragOverRoomId: string | null = null;

/** Message to show as tooltip when dragging over invalid area */
export let invalidDropMessage: string | null = null;

/** CSS coordinates for invalid drop tooltip positioning */
export let invalidDropX = 0;
export let invalidDropY = 0;

/** Callback for file icon clicks -- set by React to consume clicked file ID */
export let onFileClickCallback: ((fileId: string) => void) | null = null;

/**
 * Sets the file click callback. Called from React to wire up file viewer.
 */
export function setOnFileClick(cb: ((fileId: string) => void) | null): void {
  onFileClickCallback = cb;
}

/** Callback for filing cabinet clicks -- set by React to open persona builder */
export let onFilingCabinetClickCallback: ((agentId: string) => void) | null = null;

/** Sets the filing cabinet click callback. Called from React. */
export function setOnFilingCabinetClick(cb: ((agentId: string) => void) | null): void {
  onFilingCabinetClickCallback = cb;
}

/** Callback for desk clicks -- set by React to open file manager */
export let onDeskClickCallback: ((agentId: string) => void) | null = null;

/** Sets the desk click callback. Called from React. */
export function setOnDeskClick(cb: ((agentId: string) => void) | null): void {
  onDeskClickCallback = cb;
}

/**
 * Sets up all input event handlers on the canvas.
 * Returns a cleanup function that removes all listeners.
 */
export function setupInputHandlers(canvas: HTMLCanvasElement): () => void {
  function handleClick(e: MouseEvent): void {
    // Suppress click if user was dragging to pan
    if (dragMoved) {
      dragMoved = false;
      return;
    }

    // Editor mode handles its own clicks
    if (useEditorStore.getState().editorMode) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const state = useOfficeStore.getState();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    const tile = screenToTile(cssX, cssY, state.camera, canvasWidth, canvasHeight);
    if (!tile) return;

    // Check for file icon click before room navigation
    if (onFileClickCallback) {
      const fileId = getFileIconAtTile(tile.col, tile.row);
      if (fileId) {
        onFileClickCallback(fileId);
        return;
      }
    }

    // Check for filing cabinet click before room navigation.
    // Filing cabinet sprites are 2 tiles tall but registered with height:1 — clicks on
    // the lower half land on row+1, which may also contain other solid furniture (e.g. a
    // couch). Search both the clicked row and row-1 explicitly for a filing-cabinet type
    // so a non-cabinet hit on row+1 doesn't short-circuit finding the cabinet above it.
    if (onFilingCabinetClickCallback) {
      let cabinetItem: (typeof FURNITURE)[number] | null = null;
      for (const r of [tile.row, tile.row - 1]) {
        const idx = getFurnitureAt(tile.col, r);
        const item = idx !== null ? FURNITURE[idx] : null;
        if (item?.type === 'filing-cabinet') { cabinetItem = item; break; }
      }
      if (cabinetItem) {
        onFilingCabinetClickCallback(cabinetItem.roomId);
        return;
      }
    }

    // Check for desk click — open file manager for that agent.
    if (onDeskClickCallback) {
      const idx = getFurnitureAt(tile.col, tile.row);
      const item = idx !== null ? FURNITURE[idx] : null;
      if (item?.type === 'desk' && item.roomId && item.roomId !== 'billy') {
        onDeskClickCallback(item.roomId);
        return;
      }
    }

    // Check if clicking on an agent sprite -- navigate to their room
    for (const ch of state.characters) {
      if (ch.id === 'billy') continue; // Don't navigate to self
      if (ch.tileCol === tile.col && ch.tileRow === tile.row) {
        const agentRoom = ROOMS.find(r => r.id === ch.id);
        if (agentRoom && agentRoom.id !== state.activeRoomId) {
          state.setTargetRoom(agentRoom.id);
          startWalk('billy', agentRoom.billyStandTile.col, agentRoom.billyStandTile.row, OFFICE_TILE_MAP);
          return;
        }
      }
    }

    const room = getRoomAtTile(tile.col, tile.row);
    if (!room) {
      // Hallway / open-floor click: walk directly to the clicked tile
      startWalk('billy', tile.col, tile.row, OFFICE_TILE_MAP);
      return;
    }

    // Only navigate if clicking a different room than current active
    if (room.id === state.activeRoomId) return;

    // Set target room and start BILLY walking
    state.setTargetRoom(room.id);
    startWalk(
      'billy',
      room.billyStandTile.col,
      room.billyStandTile.row,
      OFFICE_TILE_MAP,
    );
  }

  function handleDblClick(_e: MouseEvent): void {
    toggleZoom();
  }

  function handleKeyDown(e: KeyboardEvent): void {
    // Don't trigger navigation while typing in chat input
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;

    // In editor mode, only allow zoom keys — editor handles tool keys separately
    if (useEditorStore.getState().editorMode) {
      // Allow zoom keys (z, 0, +, -, =) to pass through
      if (!['z', 'Z', '0', '+', '=', '-'].includes(e.key)) return;
    }

    if (e.key === 'z' || e.key === 'Z') {
      toggleZoom();
      return;
    }

    // 0 key: reset to auto-fit zoom
    if (e.key === '0') {
      const rect = canvas.getBoundingClientRect();
      const fitZoom = computeAutoFitZoom(rect.width, rect.height);
      startAnimatedZoom(zoomState, fitZoom, rect.width / 2, rect.height / 2);
      (globalThis as Record<string, unknown>).__boiler_reset_autofit = true;
      return;
    }

    // + or = key: zoom in by 0.5 step
    if (e.key === '+' || e.key === '=') {
      const currentZoom = useOfficeStore.getState().camera.zoom;
      const target = Math.min(nearestHalf(currentZoom) + 0.5, MAX_ZOOM);
      const rect = canvas.getBoundingClientRect();
      startAnimatedZoom(zoomState, target, rect.width / 2, rect.height / 2);
      return;
    }

    // - key: zoom out by 0.5 step
    if (e.key === '-') {
      const currentZoom = useOfficeStore.getState().camera.zoom;
      const rect = canvas.getBoundingClientRect();
      const minZoom = computeAutoFitZoom(rect.width, rect.height);
      const target = Math.max(nearestHalf(currentZoom) - 0.5, minZoom);
      startAnimatedZoom(zoomState, target, rect.width / 2, rect.height / 2);
      return;
    }

    // Escape: navigate BILLY back to his office (separate from KEY_TO_ROOM)
    if (e.key === 'Escape') {
      const state = useOfficeStore.getState();
      if (state.activeRoomId === 'billy') return;

      const billyRoom = ROOMS.find((r) => r.id === 'billy');
      if (!billyRoom) return;

      state.setTargetRoom('billy');
      startWalk('billy', billyRoom.billyStandTile.col, billyRoom.billyStandTile.row, OFFICE_TILE_MAP);
      // Apply speed walk for keyboard navigation
      const billy = state.characters.find(c => c.id === 'billy');
      if (billy) billy.speed = WALK_SPEED_KEYBOARD;
      return;
    }

    // Arrow keys: move Billy one tile at a time in the four cardinal directions.
    // Uses startWalk so animations and state transitions work normally.
    const arrowDeltas: Record<string, { dc: number; dr: number }> = {
      ArrowUp:    { dc:  0, dr: -1 },
      ArrowDown:  { dc:  0, dr:  1 },
      ArrowLeft:  { dc: -1, dr:  0 },
      ArrowRight: { dc:  1, dr:  0 },
    };
    const delta = arrowDeltas[e.key];
    if (delta) {
      e.preventDefault(); // prevent page scroll
      const { characters } = useOfficeStore.getState();
      const billy = characters.find((c) => c.id === 'billy');
      if (!billy) return;
      const nextCol = billy.tileCol + delta.dc;
      const nextRow = billy.tileRow + delta.dr;
      if (isWalkable(nextCol, nextRow, OFFICE_TILE_MAP)) {
        startWalk('billy', nextCol, nextRow, OFFICE_TILE_MAP);
      }
      return;
    }

    // First-letter keyboard shortcuts: P, M, S, I, W, 6 (War Room), B
    const roomId = KEY_TO_ROOM[e.key.toLowerCase()];
    if (roomId) {
      const state = useOfficeStore.getState();
      if (state.activeRoomId === roomId) return;

      const room = ROOMS.find((r) => r.id === roomId);
      if (!room) return;

      state.setTargetRoom(room.id);
      startWalk('billy', room.billyStandTile.col, room.billyStandTile.row, OFFICE_TILE_MAP);
      // Apply speed walk for keyboard navigation
      const billy = state.characters.find(c => c.id === 'billy');
      if (billy) billy.speed = WALK_SPEED_KEYBOARD;
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Update cursor tracking for zoom centering
    cursorScreenX = cssX;
    cursorScreenY = cssY;

    const state = useOfficeStore.getState();
    const tile = screenToTile(cssX, cssY, state.camera, rect.width, rect.height);

    if (tile) {
      hoverTileCol = tile.col;
      hoverTileRow = tile.row;
    } else {
      hoverTileCol = -1;
      hoverTileRow = -1;
    }
  }

  function handleMouseLeave(): void {
    hoverTileCol = -1;
    hoverTileRow = -1;
    isDragging = false;
  }

  // ── Click-and-Drag Pan Handler ──────────────────────────────────────────

  let dragStartX = 0;
  let dragStartY = 0;
  let dragCameraStartX = 0;
  let dragCameraStartY = 0;
  let dragMoved = false;

  function handleMouseDown(e: MouseEvent): void {
    // Editor mode handles its own mouse events
    if (useEditorStore.getState().editorMode) return;
    // Only left-click drag (button 0), ignore if over UI
    if (e.button !== 0) return;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const state = useOfficeStore.getState();
    dragCameraStartX = state.camera.x;
    dragCameraStartY = state.camera.y;
    dragMoved = false;
    isDragging = false;
  }

  function handleMouseMoveDrag(e: MouseEvent): void {
    // Editor mode handles its own mouse events
    if (useEditorStore.getState().editorMode) return;
    // Only start drag after 3px movement threshold to avoid interfering with clicks
    if (e.buttons !== 1) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!isDragging && Math.abs(dx) + Math.abs(dy) < 3) return;

    isDragging = true;
    dragMoved = true;
    userHasPanned = true;
    const state = useOfficeStore.getState();
    state.camera.x = dragCameraStartX - dx;
    state.camera.y = dragCameraStartY - dy;
    state.camera.targetX = state.camera.x;
    state.camera.targetY = state.camera.y;
  }

  function handleMouseUp(_e: MouseEvent): void {
    isDragging = false;
  }

  // ── Wheel / Pinch Zoom Handler ──────────────────────────────────────────

  function handleWheel(e: WheelEvent): void {
    // CRITICAL: prevents browser zoom on trackpad pinch (ctrlKey=true)
    e.preventDefault();

    // Disable zoom during file drag-and-drop
    if (dragOverRoomId !== null) return;

    // Normalize deltaY: mode 0 = pixels (default), 1 = lines, 2 = pages
    let deltaY = e.deltaY;
    if (e.deltaMode === 1) deltaY *= 16;
    else if (e.deltaMode === 2) deltaY *= 100;

    // Negative deltaY because positive scroll = zoom in
    onZoomInput(zoomState, -deltaY, cursorScreenX, cursorScreenY);
  }

  // ── Drag-and-Drop Handlers ──────────────────────────────────────────────

  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const state = useOfficeStore.getState();
    const tile = screenToTile(cssX, cssY, state.camera, rect.width, rect.height);

    if (tile) {
      const room = getRoomAtTile(tile.col, tile.row);
      if (room && AGENT_ROOM_IDS.has(room.id)) {
        // Valid agent room -- show drop zone highlight
        dragOverRoomId = room.id;
        invalidDropMessage = null;
      } else {
        // Invalid area (war-room, billy, hallway, or no room)
        dragOverRoomId = null;
        invalidDropMessage = "Drop files on an agent's desk";
        invalidDropX = e.clientX;
        invalidDropY = e.clientY;
      }
    } else {
      dragOverRoomId = null;
      invalidDropMessage = "Drop files on an agent's desk";
      invalidDropX = e.clientX;
      invalidDropY = e.clientY;
    }
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const state = useOfficeStore.getState();
    const tile = screenToTile(cssX, cssY, state.camera, rect.width, rect.height);

    // Reset drag state
    dragOverRoomId = null;
    invalidDropMessage = null;

    if (!tile) return;

    const room = getRoomAtTile(tile.col, tile.row);
    if (!room || !AGENT_ROOM_IDS.has(room.id)) return;

    const files = e.dataTransfer?.files;
    if (!files) return;

    const fileStore = useFileStore.getState();
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (VALID_EXTENSIONS.has(ext)) {
        fileStore.addFile(file, room.id as AgentId);
      }
    }
  }

  function handleDragLeave(_e: DragEvent): void {
    dragOverRoomId = null;
    invalidDropMessage = null;
  }

  // Attach listeners
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('dblclick', handleDblClick);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mousemove', handleMouseMoveDrag);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('dragover', handleDragOver);
  canvas.addEventListener('drop', handleDrop);
  canvas.addEventListener('dragleave', handleDragLeave);
  window.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('dblclick', handleDblClick);
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mousemove', handleMouseMoveDrag);
    canvas.removeEventListener('mouseup', handleMouseUp);
    canvas.removeEventListener('mouseleave', handleMouseLeave);
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('dragover', handleDragOver);
    canvas.removeEventListener('drop', handleDrop);
    canvas.removeEventListener('dragleave', handleDragLeave);
    window.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Removes all input handlers. Alias for calling the cleanup function
 * returned by setupInputHandlers.
 */
export function removeInputHandlers(cleanup: () => void): void {
  cleanup();
}

/**
 * Toggles zoom between auto-fit and 2x with smooth animation.
 */
function toggleZoom(): void {
  const state = useOfficeStore.getState();
  const rect = document.querySelector('canvas')?.getBoundingClientRect();
  const canvasW = rect?.width ?? 800;
  const canvasH = rect?.height ?? 600;

  const fitZoom = computeAutoFitZoom(canvasW, canvasH);
  const targetZoom = state.camera.zoom >= ZOOM_OVERVIEW_THRESHOLD ? fitZoom : 2;
  startAnimatedZoom(zoomState, targetZoom, canvasW / 2, canvasH / 2);

  if (targetZoom === fitZoom) {
    (globalThis as Record<string, unknown>).__boiler_reset_autofit = true;
  }
}

/**
 * Checks if a tile position overlaps a file icon on any agent's desk.
 * Returns the file ID if found, null otherwise.
 *
 * File icons are placed on the desk tile (1 row above the seat).
 * Up to 5 icons per desk, scattered using deterministic offsets.
 */
function getFileIconAtTile(col: number, row: number): string | null {
  const { files } = useFileStore.getState();

  for (const room of ROOMS) {
    if (!AGENT_ROOM_IDS.has(room.id)) continue;

    // Desk is 1 row above the seat tile, matching renderer placement
    const deskRow = room.seatTile.row - 1;
    const deskCol = room.seatTile.col;

    // Check if the click is on or near the desk area (2 tiles wide)
    if (row !== deskRow || col < deskCol || col > deskCol + 1) continue;

    const agentFiles = files.filter(f => f.agentId === room.id);
    const visibleFiles = agentFiles.slice(0, 5);

    for (let i = 0; i < visibleFiles.length; i++) {
      // Icon position uses same scatter logic as renderer
      const scatterCol = ((i * 7 + 3) % 5) - 2;
      const iconCol = deskCol + (i % 2) + (scatterCol > 0 ? 1 : 0);

      if (col === iconCol || col === iconCol + 1) {
        return visibleFiles[i]!.id;
      }
    }
  }

  return null;
}
