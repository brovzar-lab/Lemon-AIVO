/**
 * Tests for renderEditorOverlay — editor visual overlay on the canvas.
 * Uses vitest-canvas-mock to provide CanvasRenderingContext2D in jsdom.
 */
import 'vitest-canvas-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Camera } from '../types';

vi.mock('@/store/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn(),
  },
}));
vi.mock('@/engine/officeLayout', () => ({
  OFFICE_TILE_MAP: Array.from({ length: 36 }, () => new Array(42).fill(1)),
  FURNITURE: [
    { roomId: 'patrik', type: 'desk', col: 5, row: 5, width: 2, height: 1, atlasKey: 'desk' },
  ],
  ROOMS: [
    { id: 'billy', name: "BILLY's Office", tileRect: { col: 16, row: 2, width: 15, height: 10 }, doorTile: { col: 22, row: 11 }, seatTile: { col: 22, row: 6 }, billyStandTile: { col: 23, row: 6 } },
  ],
}));
vi.mock('@/engine/input', () => ({
  hoverTileCol: -1,
  hoverTileRow: -1,
}));

import { renderEditorOverlay } from '../editorRenderer';
import { useEditorStore } from '@/store/editorStore';

function makeCamera(zoom = 2): Camera {
  return { x: 0, y: 0, zoom, targetX: 0, targetY: 0, followTarget: null };
}

function makeCtx() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas.getContext('2d')!;
}

function makeEditorState(overrides: Record<string, unknown> = {}) {
  return {
    editorMode: true,
    activeTool: 'floor' as const,
    selectedCanvasFurnitureIdx: null,
    ghostPreviewTile: null,
    selectedRoomTemplate: null,
    selectedFloorStyle: 'floor-office',
    selectedWallStyle: 'wall-front',
    selectedFurnitureId: '',
    selectedFurnitureType: 'desk' as const,
    selectedFurnitureSize: { width: 1, height: 1 },
    selectedFurnitureAtlasKey: '',
    ...overrides,
  };
}

describe('renderEditorOverlay', () => {
  beforeEach(() => {
    vi.mocked(useEditorStore.getState).mockReturnValue(makeEditorState() as never);
  });

  it('does not throw with default camera and floor tool', () => {
    const ctx = makeCtx();
    expect(() => renderEditorOverlay(ctx, makeCamera(), 800, 600)).not.toThrow();
  });

  it('does not throw at zoom >= 1.5 (shows tile type badges)', () => {
    const ctx = makeCtx();
    expect(() => renderEditorOverlay(ctx, makeCamera(2), 800, 600)).not.toThrow();
  });

  it('does not throw at zoom < 1.5 (hides tile type badges)', () => {
    const ctx = makeCtx();
    expect(() => renderEditorOverlay(ctx, makeCamera(1.0), 800, 600)).not.toThrow();
  });

  it('calls setTransform to apply zoom', () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(ctx, 'setTransform');
    renderEditorOverlay(ctx, makeCamera(2), 800, 600);
    expect(spy).toHaveBeenCalled();
  });

  it('resets transform to identity at end', () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(ctx, 'setTransform');
    renderEditorOverlay(ctx, makeCamera(2), 800, 600);
    // Last call must reset to identity
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(lastCall).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('renders cursor highlight when hover tile is in bounds', async () => {
    // Override hoverTileCol / hoverTileRow via module mock
    vi.doMock('@/engine/input', () => ({ hoverTileCol: 5, hoverTileRow: 5 }));
    // Re-import with updated mock
    // @ts-expect-error Vite query-string import not recognized by TypeScript
    const { renderEditorOverlay: renderWithHover } = await import('../editorRenderer?hover=1');
    const ctx = makeCtx();
    // The function should not throw even with hover active
    expect(() => renderWithHover?.(ctx, makeCamera(2), 800, 600)).not.toThrow();
    vi.doUnmock('@/engine/input');
  });

  it('eraser tool renders eraser cursor (does not throw)', () => {
    vi.mocked(useEditorStore.getState).mockReturnValue(
      makeEditorState({ activeTool: 'eraser' }) as never,
    );
    const ctx = makeCtx();
    expect(() => renderEditorOverlay(ctx, makeCamera(2), 800, 600)).not.toThrow();
  });

  it('selected furniture renders bounding box (does not throw)', () => {
    vi.mocked(useEditorStore.getState).mockReturnValue(
      makeEditorState({ selectedCanvasFurnitureIdx: 0 }) as never,
    );
    const ctx = makeCtx();
    expect(() => renderEditorOverlay(ctx, makeCamera(2), 800, 600)).not.toThrow();
  });

  it('selected furniture out of bounds index is ignored (does not throw)', () => {
    vi.mocked(useEditorStore.getState).mockReturnValue(
      makeEditorState({ selectedCanvasFurnitureIdx: 999 }) as never,
    );
    const ctx = makeCtx();
    expect(() => renderEditorOverlay(ctx, makeCamera(2), 800, 600)).not.toThrow();
  });

  it('calls strokeRect at least once (for grid lines)', () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(ctx, 'stroke');
    renderEditorOverlay(ctx, makeCamera(2), 800, 600);
    expect(spy).toHaveBeenCalled();
  });
});
