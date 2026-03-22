/**
 * Tests for camera coordinate conversion and auto-fit zoom.
 * TDD: RED phase — screenToTile/tileToScreen round-trip and computeAutoFitZoom
 * behavior are verified here. Some tests may pass (GREEN) already; round-trip
 * tests may be RED if edge cases fail.
 */
import { describe, it, expect } from 'vitest';
import { screenToTile, tileToScreen, computeAutoFitZoom, createCamera } from '../camera';
import { TILE_SIZE } from '../types';

describe('screenToTile / tileToScreen round-trip', () => {
  it('round-trip returns original tile for default camera', () => {
    const camera = createCamera();
    const canvasW = 800;
    const canvasH = 600;
    const col = 10;
    const row = 5;
    const screen = tileToScreen(col, row, camera, canvasW, canvasH);
    // Add half a tile to hit the center of the tile (avoids floor rounding edge)
    const tile = screenToTile(
      screen.x + TILE_SIZE / 2,
      screen.y + TILE_SIZE / 2,
      camera, canvasW, canvasH
    );
    expect(tile).not.toBeNull();
    expect(tile!.col).toBe(col);
    expect(tile!.row).toBe(row);
  });

  it('round-trip works at zoom 1x', () => {
    const camera = { ...createCamera(), zoom: 1 };
    const screen = tileToScreen(3, 7, camera, 800, 600);
    const tile = screenToTile(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, camera, 800, 600);
    expect(tile?.col).toBe(3);
    expect(tile?.row).toBe(7);
  });

  it('screenToTile returns null for coordinates outside the tile map', () => {
    const camera = createCamera();
    // Very negative screen coordinates — off the map
    const tile = screenToTile(-9999, -9999, camera, 800, 600);
    expect(tile).toBeNull();
  });
});

describe('computeAutoFitZoom', () => {
  it('returns a zoom that fits the entire map within canvas bounds', () => {
    const zoom = computeAutoFitZoom(800, 600);
    // At this zoom, map should fit (including 10-tile padding per axis)
    const mapCols = 42;  // from officeLayout default
    const mapRows = 36;
    const mapPixelW = (mapCols + 10) * TILE_SIZE * zoom;
    const mapPixelH = (mapRows + 10) * TILE_SIZE * zoom;
    expect(mapPixelW).toBeLessThanOrEqual(800 + 1); // +1 for floating point
    expect(mapPixelH).toBeLessThanOrEqual(600 + 1);
  });

  it('returns a zoom greater than 0', () => {
    const zoom = computeAutoFitZoom(800, 600);
    expect(zoom).toBeGreaterThan(0);
  });
});
