/**
 * Camera system with float zoom, smooth follow, and coordinate conversion.
 * Supports fractional zoom levels (e.g. 1.0, 1.5, 2.7). Below ZOOM_OVERVIEW_THRESHOLD
 * is overview mode; above is follow mode. Auto-fit zoom returns a raw float.
 */
import { TILE_SIZE } from './types';
import type { Camera, TileCoord } from './types';
import { OFFICE_TILE_MAP } from './officeLayout';

/**
 * Computes the zoom level at which the entire office map fits within the
 * given canvas dimensions. Returns a raw float with a floor of 0.5 to
 * prevent absurdly small zoom on very large screens.
 */
export function computeAutoFitZoom(canvasWidth: number, canvasHeight: number): number {
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  const mapRows = OFFICE_TILE_MAP.length;
  // No padding — fill the entire canvas with the office map
  const mapPixelW = mapCols * TILE_SIZE;
  const mapPixelH = mapRows * TILE_SIZE;

  return Math.max(0.5, Math.min(canvasWidth / mapPixelW, canvasHeight / mapPixelH));
}

/**
 * Adjusts camera position so the world point under the cursor stays under the
 * cursor as zoom changes. Sets both camera.x/y and targetX/targetY to prevent
 * the lerp from fighting the zoom adjustment.
 */
export function applyCursorCenteredZoom(
  camera: Camera,
  oldZoom: number,
  newZoom: number,
  cursorScreenX: number,
  cursorScreenY: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  const mapRows = OFFICE_TILE_MAP.length;
  const mapWorldW = mapCols * TILE_SIZE;
  const mapWorldH = mapRows * TILE_SIZE;

  // tx/ty are the screen-space origin of world (0,0)
  const oldTx = (canvasWidth - mapWorldW * oldZoom) / 2 - camera.x;
  const oldTy = (canvasHeight - mapWorldH * oldZoom) / 2 - camera.y;

  const worldX = (cursorScreenX - oldTx) / oldZoom;
  const worldY = (cursorScreenY - oldTy) / oldZoom;

  // New camera offset so same world point maps to same screen point
  camera.x = (canvasWidth - mapWorldW * newZoom) / 2 - (cursorScreenX - worldX * newZoom);
  camera.y = (canvasHeight - mapWorldH * newZoom) / 2 - (cursorScreenY - worldY * newZoom);

  // Prevent lerp from fighting zoom adjustment
  camera.targetX = camera.x;
  camera.targetY = camera.y;
}

/**
 * Creates a camera centered on BILLY's starting room with default zoom=2.
 */
export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 2,
    targetX: 0,
    targetY: 0,
    followTarget: null,
  };
}

/**
 * Smoothly lerps camera toward targetX/targetY. Camera position is kept as float
 * for smooth sub-pixel rendering — setTransform handles sub-pixel math uniformly.
 */
export function updateCamera(
  camera: Camera,
  _dt: number,
  _canvasWidth: number,
  _canvasHeight: number,
): void {
  // Lerp toward target (float position for smooth sub-pixel rendering)
  camera.x = camera.x + (camera.targetX - camera.x) * 0.1;
  camera.y = camera.y + (camera.targetY - camera.y) * 0.1;
}

/**
 * Converts CSS click coordinates to tile col/row.
 * Accounts for zoom, camera offset, and map centering.
 * Returns null if the click is outside the tile map bounds.
 */
export function screenToTile(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): TileCoord | null {
  const tileSize = TILE_SIZE * camera.zoom;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  const mapRows = OFFICE_TILE_MAP.length;
  const mapW = mapCols * tileSize;
  const mapH = mapRows * tileSize;

  // Map is centered in the canvas, then shifted by camera offset (no rounding — float math)
  const offsetX = (canvasWidth - mapW) / 2 - camera.x;
  const offsetY = (canvasHeight - mapH) / 2 - camera.y;

  const col = Math.floor((screenX - offsetX) / tileSize);
  const row = Math.floor((screenY - offsetY) / tileSize);

  if (col < 0 || col >= mapCols || row < 0 || row >= mapRows) return null;
  return { col, row };
}

/**
 * Converts a tile col/row to screen pixel coordinates.
 * Used for rendering UI overlays at tile positions.
 */
export function tileToScreen(
  col: number,
  row: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const tileSize = TILE_SIZE * camera.zoom;
  const mapCols = OFFICE_TILE_MAP[0]!.length;
  const mapRows = OFFICE_TILE_MAP.length;
  const mapW = mapCols * tileSize;
  const mapH = mapRows * tileSize;

  const offsetX = (canvasWidth - mapW) / 2 - camera.x;
  const offsetY = (canvasHeight - mapH) / 2 - camera.y;

  return {
    x: col * tileSize + offsetX,
    y: row * tileSize + offsetY,
  };
}
