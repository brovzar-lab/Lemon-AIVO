/**
 * Sprite loading, caching, and Phase 2 placeholder colors (fallback).
 *
 * Phase 14: Multi-sheet loader for LimeZu Modern Interiors assets.
 * Loads 6 character sheets (32x32 premade) and 12 environment sheets in parallel.
 * Falls back to PLACEHOLDER_COLORS if sheets haven't loaded yet.
 */
import type { SpriteFrame } from './types';
import { CHARACTER_SHEET_NAMES } from './spriteAtlas';
import { SHEET_PATHS, FURNITURE_48_SHEET_PATHS, FURNITURE_COMPILED_SHEET_PATHS } from './limeZuAtlas';
import { CHAR_SHEET_PATHS } from './limeZuCharFrames';

// ── Placeholder Colors (Phase 2 fallback) ────────────────────────────────────
// Warm tones in offices, cool tones in hallways and War Room
export const PLACEHOLDER_COLORS: Record<string, string> = {
  floor: '#6e665e',
  wall: '#453e38',
  door: '#7a7268',
  hallway: '#584f48',
  billy: '#e8a838',
  patrik: '#8B5CF6',
  marcos: '#3B82F6',
  sandra: '#10B981',
  isaac: '#F59E0B',
  wendy: '#EC4899',
  charlie: '#F97316',
  'war-room-floor': '#4a5060',
};

// ── Sprite Sheet Storage ─────────────────────────────────────────────────────

const characterSheets: Map<string, HTMLImageElement> = new Map();
const environmentSheets: Map<string, HTMLImageElement> = new Map();

// Tracks in-flight lazy loads for 48×48 Singles so we don't double-load
const lazyLoadingSheets: Map<string, Promise<HTMLImageElement>> = new Map();

// Listeners notified when a lazy-loaded sheet finishes (for SpritePreview re-renders)
const onSheetLoadedCallbacks: Set<() => void> = new Set();

/** Register a callback to be called whenever a lazy-loaded sheet finishes. */
export function onSheetLoaded(cb: () => void): () => void {
  onSheetLoadedCallbacks.add(cb);
  return () => onSheetLoadedCallbacks.delete(cb);
}

/** Trigger a lazy load of a 48×48 Singles sheet on first request. Returns null immediately. */
function lazyLoadSheet(sheetId: string): null {
  if (lazyLoadingSheets.has(sheetId)) return null;
  const path = FURNITURE_48_SHEET_PATHS[sheetId];
  if (!path) return null;
  const promise = loadSpriteSheet(path).then((img) => {
    environmentSheets.set(sheetId, img);
    onSheetLoadedCallbacks.forEach((cb) => cb());
    return img;
  });
  lazyLoadingSheets.set(sheetId, promise);
  return null;
}

// ── Sprite Sheet Loading ────────────────────────────────────────────────────

/**
 * Loads a sprite sheet image from a URL. Returns a promise that resolves
 * when the image is loaded.
 */
export function loadSpriteSheet(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite sheet: ${src}`));
    img.src = src;
  });
}

/**
 * Loads all required sprite sheets: 6 character sheets + 12 environment sheets.
 * Called during app initialization. Renderer falls back to colored rectangles
 * if this hasn't completed yet.
 *
 * Phase 14: Loads LimeZu premade character sheets from CHAR_SHEET_PATHS
 * and LimeZu environment/furniture/UI sheets from SHEET_PATHS.
 */
export async function loadAllAssets(): Promise<void> {
  const charPromises: Promise<void>[] = [];
  const envPromises: Promise<void>[] = [];

  // Load character sheets from LimeZu premade character paths
  for (const name of CHARACTER_SHEET_NAMES) {
    const path = CHAR_SHEET_PATHS[name];
    if (path) {
      charPromises.push(
        loadSpriteSheet(path).then((img) => {
          characterSheets.set(name, img);
        }),
      );
    }
  }

  // Load all environment sheets from SHEET_PATHS registry in parallel
  for (const [sheetId, path] of Object.entries(SHEET_PATHS)) {
    envPromises.push(
      loadSpriteSheet(path).then((img) => {
        environmentSheets.set(sheetId, img);
      }),
    );
  }

  // Load compiled 48×48 theme sheets eagerly (small count, used by renderer + browser)
  for (const [sheetId, path] of Object.entries(FURNITURE_COMPILED_SHEET_PATHS)) {
    envPromises.push(
      loadSpriteSheet(path).then((img) => {
        environmentSheets.set(sheetId, img);
      }),
    );
  }

  // Load character sheets first (critical for gameplay), independently from environment
  const charResults = await Promise.allSettled(charPromises);
  const charLoaded = charResults.filter(r => r.status === 'fulfilled').length;
  const charFailed = charResults.filter(r => r.status === 'rejected').length;
  console.log(`🎭 Character sprites: ${charLoaded} loaded, ${charFailed} failed`);

  // Load environment sheets (non-blocking for character rendering)
  const envResults = await Promise.allSettled(envPromises);
  const envLoaded = envResults.filter(r => r.status === 'fulfilled').length;
  const envFailed = envResults.filter(r => r.status === 'rejected').length;
  if (envFailed > 0) {
    console.warn(`🏢 Environment sprites: ${envLoaded} loaded, ${envFailed} failed`);
  } else {
    console.log(`🏢 Environment sprites: ${envLoaded} loaded`);
  }
}

// ── Sheet Getters ────────────────────────────────────────────────────────────

/**
 * Returns the loaded sprite sheet for a character, or null if not yet loaded.
 */
export function getCharacterSheet(characterId: string): HTMLImageElement | null {
  return characterSheets.get(characterId) ?? null;
}

/**
 * Returns the loaded environment sprite sheet by sheet ID, or null if not yet loaded.
 * Sheet IDs correspond to keys in SHEET_PATHS (e.g., 'generic', 'floors', 'conference').
 */
export function getEnvironmentSheetById(sheetId: string): HTMLImageElement | null {
  const cached = environmentSheets.get(sheetId);
  if (cached) return cached;
  // 48-* sheets are lazy-loaded on first request
  if (sheetId.startsWith('48-')) return lazyLoadSheet(sheetId);
  return null;
}

// ── Sprite Cache ────────────────────────────────────────────────────────────
// Caches pre-scaled canvas elements per quantized zoom level for fast rendering.
// Zoom is quantized to nearest 0.5 to prevent cache explosion at fractional values.

const spriteCache = new Map<number, Map<string, HTMLCanvasElement>>();

/**
 * Quantizes zoom to nearest 0.5 increment (e.g. 1.0, 1.5, 2.0, 2.5).
 * Prevents cache explosion when zoom is a continuous float.
 */
export function getQuantizedZoom(zoom: number): number {
  return Math.round(zoom * 2) / 2;
}

/**
 * Extracts a frame from a sprite sheet and returns a pre-scaled cached canvas.
 * Uses quantized zoom for both cache key and canvas dimensions.
 * Sets imageSmoothingEnabled=false for pixel-perfect scaling.
 */
export function getCachedSprite(
  sheet: HTMLImageElement,
  frame: SpriteFrame,
  zoom: number,
): HTMLCanvasElement {
  const cacheZoom = getQuantizedZoom(zoom);

  let zoomCache = spriteCache.get(cacheZoom);
  if (!zoomCache) {
    zoomCache = new Map();
    spriteCache.set(cacheZoom, zoomCache);
  }

  // Include sheet src in cache key so different sheets with same frame coords don't collide
  const key = `${sheet.src}:${frame.x},${frame.y},${frame.w},${frame.h}`;
  let cached = zoomCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = frame.w * cacheZoom;
    cached.height = frame.h * cacheZoom;
    const cctx = cached.getContext('2d')!;
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(
      sheet,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      cached.width,
      cached.height,
    );
    zoomCache.set(key, cached);
  }

  return cached;
}

/**
 * Clears all cached sprites. Should be called on zoom level change.
 */
export function clearSpriteCache(): void {
  spriteCache.clear();
}
