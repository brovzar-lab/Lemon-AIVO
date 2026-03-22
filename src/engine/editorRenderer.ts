/**
 * Editor visual overlays rendered on top of the game canvas in edit mode.
 *
 * Draws:
 *   - Tile grid lines (dashed, subtle blue)
 *   - Cursor highlight (blue outline at hover position)
 *   - Tile type indicators (wall/door badges)
 *   - Selection bounding box for furniture
 *   - Furniture placement ghost preview
 */
import { TileType, TILE_SIZE } from './types';
import type { Camera } from './types';
import { OFFICE_TILE_MAP, FURNITURE, ROOMS } from './officeLayout';
import { useEditorStore } from '@/store/editorStore';
import { hoverTileCol, hoverTileRow } from './input';
import { ROOM_TEMPLATES } from './editorInput';

// ── Colors ──────────────────────────────────────────────────────────────────

const GRID_COLOR = 'rgba(59,130,246,0.13)';
const CURSOR_FILL = 'rgba(59,130,246,0.12)';
const CURSOR_STROKE = 'rgba(59,130,246,0.7)';
const WALL_PREVIEW = 'rgba(59,130,246,0.35)';
const DOOR_PREVIEW = 'rgba(34,197,94,0.35)';
const ERASER_FILL = 'rgba(239,68,68,0.2)';
const ERASER_STROKE = 'rgba(239,68,68,0.6)';

// ── Main Render Function ────────────────────────────────────────────────────

export function renderEditorOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const zoom = camera.zoom;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  const mapRows = OFFICE_TILE_MAP.length;
  const mapWorldW = mapCols * TILE_SIZE;
  const mapWorldH = mapRows * TILE_SIZE;

  // Same transform as renderer.ts
  const tx = (canvasWidth - mapWorldW * zoom) / 2 - camera.x;
  const ty = (canvasHeight - mapWorldH * zoom) / 2 - camera.y;

  // Viewport culling bounds
  const worldLeft = -tx / zoom;
  const worldTop = -ty / zoom;
  const worldRight = (canvasWidth - tx) / zoom;
  const worldBottom = (canvasHeight - ty) / zoom;
  const minCol = Math.max(0, Math.floor(worldLeft / TILE_SIZE));
  const maxCol = Math.min(mapCols - 1, Math.floor(worldRight / TILE_SIZE));
  const minRow = Math.max(0, Math.floor(worldTop / TILE_SIZE));
  const maxRow = Math.min(mapRows - 1, Math.floor(worldBottom / TILE_SIZE));

  const editorState = useEditorStore.getState();

  // ── Grid Lines ──────────────────────────────────────────────────────────

  ctx.setTransform(zoom, 0, 0, zoom, tx, ty);
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5 / zoom; // thin lines regardless of zoom

  // Vertical lines
  for (let c = minCol; c <= maxCol + 1; c++) {
    const x = c * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, minRow * TILE_SIZE);
    ctx.lineTo(x, (maxRow + 1) * TILE_SIZE);
    ctx.stroke();
  }

  // Horizontal lines
  for (let r = minRow; r <= maxRow + 1; r++) {
    const y = r * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(minCol * TILE_SIZE, y);
    ctx.lineTo((maxCol + 1) * TILE_SIZE, y);
    ctx.stroke();
  }

  // ── Tile Type Indicators (small badges on walls/doors) ────────────────

  if (zoom >= 1.5) {
    ctx.font = `${Math.max(6, 8 / zoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = OFFICE_TILE_MAP[r]![c]!;

        if (tile === TileType.WALL) {
          ctx.fillStyle = WALL_PREVIEW;
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (tile === TileType.DOOR) {
          ctx.fillStyle = DOOR_PREVIEW;
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Cursor Highlight ──────────────────────────────────────────────────

  if (hoverTileCol >= 0 && hoverTileRow >= 0 &&
      hoverTileCol < mapCols && hoverTileRow < mapRows) {
    const cursorX = hoverTileCol * TILE_SIZE;
    const cursorY = hoverTileRow * TILE_SIZE;

    // Tool-specific cursor colors
    if (editorState.activeTool === 'eraser') {
      ctx.fillStyle = ERASER_FILL;
      ctx.fillRect(cursorX, cursorY, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = ERASER_STROKE;
    } else {
      ctx.fillStyle = CURSOR_FILL;
      ctx.fillRect(cursorX, cursorY, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = CURSOR_STROKE;
    }

    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(cursorX, cursorY, TILE_SIZE, TILE_SIZE);
  }

  // ── Selected Furniture Bounding Box ──────────────────────────────────

  const selectedIdx = editorState.selectedCanvasFurnitureIdx;
  if (selectedIdx !== null && selectedIdx >= 0 && selectedIdx < FURNITURE.length) {
    const f = FURNITURE[selectedIdx]!;
    const fx = f.col * TILE_SIZE;
    const fy = f.row * TILE_SIZE;
    const fw = f.width * TILE_SIZE;
    const fh = f.height * TILE_SIZE;

    // Dashed bounding box
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.setLineDash([]);

    // Corner handles
    const handleSize = 4 / zoom;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(fx - handleSize / 2, fy - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(fx + fw - handleSize / 2, fy - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(fx - handleSize / 2, fy + fh - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(fx + fw - handleSize / 2, fy + fh - handleSize / 2, handleSize, handleSize);

    // Rotation badge — shown when furniture has non-zero rotation
    const rotation = f.rotation ?? 0;
    if (rotation !== 0) {
      const label = `↻ ${rotation}°`;
      const fontSize = Math.max(8, 10 / zoom);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = '#3b82f6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, fx + 2 / zoom, fy - 2 / zoom);
    }
  }

  // ── Ghost Preview (Room Template tool) ───────────────────────────────

  const ghostTile = editorState.ghostPreviewTile;
  const selectedTemplateId = editorState.selectedRoomTemplate;
  if (ghostTile && selectedTemplateId && editorState.activeTool === 'room-template') {
    const template = ROOM_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (template) {
      let ghostW = template.width;
      let ghostH = template.height;
      if (template.kind === 'room-clone' && template.roomId) {
        const sourceRoom = ROOMS.find((r) => r.id === template.roomId);
        if (sourceRoom) {
          ghostW = sourceRoom.tileRect.width;
          ghostH = sourceRoom.tileRect.height;
        }
      }
      const gx = ghostTile.col * TILE_SIZE;
      const gy = ghostTile.row * TILE_SIZE;
      const gw = ghostW * TILE_SIZE;
      const gh = ghostH * TILE_SIZE;

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'rgba(59,130,246,0.5)';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = 'rgba(59,130,246,0.9)';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 3 / zoom]);
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.setLineDash([]);
    }
  }

  // Reset transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
