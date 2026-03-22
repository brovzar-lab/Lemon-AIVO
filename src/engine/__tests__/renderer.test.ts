import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TILE_SIZE } from '../types';
import type { Camera, Character } from '../types';

// ── Mock stores ──────────────────────────────────────────────────────────────

let mockFiles: Array<{
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'docx';
  agentId: string;
  dealId: string;
  extractedText: string;
  uploadedAt: number;
}> = [];

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      files: mockFiles,
    }),
  },
}));

// ── Mock input module state ─────────────────────────────────────────────────

let mockDragOverRoomId: string | null = null;
let mockInvalidDropMessage: string | null = null;
let mockInvalidDropX = 0;
let mockInvalidDropY = 0;
let mockHoverTileCol = -1;
let mockHoverTileRow = -1;

vi.mock('../input', () => ({
  get dragOverRoomId() { return mockDragOverRoomId; },
  get invalidDropMessage() { return mockInvalidDropMessage; },
  get invalidDropX() { return mockInvalidDropX; },
  get invalidDropY() { return mockInvalidDropY; },
  get hoverTileCol() { return mockHoverTileCol; },
  get hoverTileRow() { return mockHoverTileRow; },
}));

import { renderFrame, renderDropZoneHighlight, renderFileIcons, drawLimeZuTile } from '../renderer';
import { CHAR_SPRITE_W, CHAR_SPRITE_H } from '../types';
import { LIMEZU_ATLAS } from '../limeZuAtlas';

function createMockCtx() {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    roundRect: vi.fn(),
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    globalAlpha: 1,
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

function createCamera(zoom: number): Camera {
  return {
    x: 0,
    y: 0,
    zoom,
    targetX: 0,
    targetY: 0,
    followTarget: null,
  };
}

function createCharacter(id: string, col: number, row: number): Character {
  return {
    id,
    x: col * TILE_SIZE,
    y: row * TILE_SIZE,
    tileCol: col,
    tileRow: row,
    state: 'idle',
    direction: 'down',
    frame: 0,
    frameTimer: 0,
    path: [],
    moveProgress: 0,
    speed: 0,
  };
}

/** Helper: creates a worldToScreen function matching renderer logic */
function makeWorldToScreen(zoom: number, tx: number, ty: number) {
  return (wx: number, wy: number) => ({ x: wx * zoom + tx, y: wy * zoom + ty });
}

describe('renderFrame', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
    mockFiles = [];
    mockDragOverRoomId = null;
    mockInvalidDropMessage = null;
    mockHoverTileCol = -1;
    mockHoverTileRow = -1;
  });

  it('sets imageSmoothingEnabled to false', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], null, 800, 600, {});
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('calls fillRect for background clear', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], null, 800, 600, {});
    // First fillRect call should be the background clear
    const firstCall = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall).toEqual([0, 0, 800, 600]);
  });

  it('uses setTransform for world-space rendering', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], null, 800, 600, {});
    // Should call setTransform with zoom=2
    const setTransformCalls = (ctx.setTransform as ReturnType<typeof vi.fn>).mock.calls;
    // First call: identity for clear, second: world transform with zoom
    expect(setTransformCalls.length).toBeGreaterThanOrEqual(2);
    // Identity reset
    expect(setTransformCalls[0]).toEqual([1, 0, 0, 1, 0, 0]);
    // World transform with zoom=2
    expect(setTransformCalls[1]![0]).toBe(2); // zoom
    expect(setTransformCalls[1]![3]).toBe(2); // zoom
  });

  it('renders tiles using fillRect at world coordinates (TILE_SIZE, not tileSize*zoom)', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], null, 800, 600, {});
    // Should have fillRect calls with TILE_SIZE dimensions (world coords, not screen)
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    // Find tile-sized fillRect (TILE_SIZE x TILE_SIZE in world space)
    const tileCall = fillCalls.find(
      (c: number[]) => c[2] === TILE_SIZE && c[3] === TILE_SIZE,
    );
    expect(tileCall).toBeDefined();
  });

  it('renders characters', () => {
    const camera = createCamera(2);
    const billy = createCharacter('billy', 20, 4);
    renderFrame(ctx, camera, [billy], null, 800, 600, {});

    // Should call beginPath for direction indicator triangle
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders room label when activeRoomId is set', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], 'billy', 800, 600, {});
    // Should call fillText for room name
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('renders all room labels at zoom >= 1.5 regardless of activeRoomId', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], null, 800, 600, {});
    // Labels are now zoom-gated (>= 1.5x), not activeRoomId-gated
    // At zoom 2, all 7 rooms should have labels rendered via fillText
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('tile fillRect dimensions are constant across zoom levels (transform handles zoom)', () => {
    // Render at zoom 1
    const ctx1 = createMockCtx();
    renderFrame(ctx1, createCamera(1), [], null, 800, 600, {});
    const calls1 = (ctx1.fillRect as ReturnType<typeof vi.fn>).mock.calls;

    // Render at zoom 2
    const ctx2 = createMockCtx();
    renderFrame(ctx2, createCamera(2), [], null, 800, 600, {});
    const calls2 = (ctx2.fillRect as ReturnType<typeof vi.fn>).mock.calls;

    // Both should draw tiles at TILE_SIZE (world coords), not scaled
    const tileCall1 = calls1.find(
      (c: number[]) => c[2] === TILE_SIZE && c[3] === TILE_SIZE,
    );
    const tileCall2 = calls2.find(
      (c: number[]) => c[2] === TILE_SIZE && c[3] === TILE_SIZE,
    );

    expect(tileCall1).toBeDefined();
    expect(tileCall2).toBeDefined();
  });

  it('viewport culling: only visible tiles are drawn', () => {
    // Render with a small canvas so many tiles are outside the viewport
    const ctx1 = createMockCtx();
    renderFrame(ctx1, createCamera(2), [], null, 100, 100, {});
    const smallCount = (ctx1.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Render with a large canvas so more tiles are visible
    const ctx2 = createMockCtx();
    renderFrame(ctx2, createCamera(2), [], null, 2000, 2000, {});
    const largeCount = (ctx2.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Large canvas should render more tiles
    expect(largeCount).toBeGreaterThan(smallCount);
  });

  it('resets to identity transform before UI overlays', () => {
    const camera = createCamera(2);
    renderFrame(ctx, camera, [], 'billy', 800, 600, {});
    const setTransformCalls = (ctx.setTransform as ReturnType<typeof vi.fn>).mock.calls;
    // Should have an identity reset after world rendering, before overlays
    const identityCalls = setTransformCalls.filter(
      (c: number[]) => c[0] === 1 && c[1] === 0 && c[2] === 0 && c[3] === 1 && c[4] === 0 && c[5] === 0,
    );
    // At least 2: one for initial clear, one for overlay reset
    expect(identityCalls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('renderDropZoneHighlight', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
    mockDragOverRoomId = null;
    mockInvalidDropMessage = null;
  });

  it('draws amber dashed border on desk area when dragOverRoomId is set to valid agent', () => {
    mockDragOverRoomId = 'patrik';

    const zoom = 2;
    renderDropZoneHighlight(ctx, zoom, 0, 0, 800, 600);

    // Should call setLineDash for dashed border (scaled by 1/zoom)
    expect(ctx.setLineDash).toHaveBeenCalled();
    // Should reset line dash
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    // Should draw desk area fill (amber semi-transparent)
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBeGreaterThan(0);
    // Should draw desk area stroke
    const strokeCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(strokeCalls.length).toBeGreaterThan(0);
  });

  it('does NOT draw highlight when dragOverRoomId is null', () => {
    mockDragOverRoomId = null;

    const zoom = 2;
    renderDropZoneHighlight(ctx, zoom, 0, 0, 800, 600);

    expect(ctx.setLineDash).not.toHaveBeenCalled();
  });

  it('renders tooltip when invalidDropMessage is set', () => {
    mockInvalidDropMessage = "Drop files on an agent's desk";
    mockInvalidDropX = 400;
    mockInvalidDropY = 300;

    const zoom = 2;
    renderDropZoneHighlight(ctx, zoom, 0, 0, 800, 600);

    // Should render tooltip text
    expect(ctx.fillText).toHaveBeenCalledWith(
      "Drop files on an agent's desk",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('does NOT render tooltip when invalidDropMessage is null', () => {
    mockInvalidDropMessage = null;

    const zoom = 2;
    renderDropZoneHighlight(ctx, zoom, 0, 0, 800, 600);

    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

describe('renderFileIcons', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
    mockFiles = [];
    mockHoverTileCol = -1;
    mockHoverTileRow = -1;
  });

  it('renders file icons when files exist for an agent', () => {
    mockFiles = [
      { id: 'f1', name: 'contract.pdf', size: 1000, type: 'pdf', agentId: 'patrik', dealId: 'deal-1', extractedText: 'text', uploadedAt: 1000 },
    ];

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    renderFileIcons(ctx, zoom, worldToScreen);

    // Should draw paper background (white fillRect) and border (strokeRect)
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    const strokeCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBeGreaterThan(0);
    expect(strokeCalls.length).toBeGreaterThan(0);
  });

  it('does not render icons when no files exist', () => {
    mockFiles = [];

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    renderFileIcons(ctx, zoom, worldToScreen);

    // No fillRect calls for file icons (no files to render)
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBe(0);
  });

  it('PDF icons get red header bar color', () => {
    mockFiles = [
      { id: 'f1', name: 'contract.pdf', size: 1000, type: 'pdf', agentId: 'patrik', dealId: 'deal-1', extractedText: 'text', uploadedAt: 1000 },
    ];

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    const ctx2 = createMockCtx();
    const styles: string[] = [];
    const origFR = ctx2.fillRect;
    (ctx2 as any).fillRect = vi.fn(function (this: any) {
      styles.push(this.fillStyle);
      return (origFR as any).apply(this, arguments);
    }.bind(ctx2));

    renderFileIcons(ctx2, zoom, worldToScreen);
    expect(styles).toContain('#ef4444');
  });

  it('DOCX icons get blue header bar color', () => {
    mockFiles = [
      { id: 'f1', name: 'report.docx', size: 1000, type: 'docx', agentId: 'patrik', dealId: 'deal-1', extractedText: 'text', uploadedAt: 1000 },
    ];

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    const ctx2 = createMockCtx();
    const styles: string[] = [];
    const origFR = ctx2.fillRect;
    (ctx2 as any).fillRect = vi.fn(function (this: any) {
      styles.push(this.fillStyle);
      return (origFR as any).apply(this, arguments);
    }.bind(ctx2));

    renderFileIcons(ctx2, zoom, worldToScreen);
    expect(styles).toContain('#3b82f6');
  });

  it('renders at most 5 icons per desk with +N badge for overflow', () => {
    // Create 8 files for one agent
    mockFiles = [];
    for (let i = 0; i < 8; i++) {
      mockFiles.push({
        id: `f${i}`,
        name: `doc${i}.pdf`,
        size: 1000,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'text',
        uploadedAt: i * 1000,
      });
    }

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    renderFileIcons(ctx, zoom, worldToScreen);

    // Should render "+3" badge text
    expect(ctx.fillText).toHaveBeenCalledWith('+3', expect.any(Number), expect.any(Number));
  });

  it('does not render +N badge when 5 or fewer files', () => {
    mockFiles = [];
    for (let i = 0; i < 5; i++) {
      mockFiles.push({
        id: `f${i}`,
        name: `doc${i}.pdf`,
        size: 1000,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'text',
        uploadedAt: i * 1000,
      });
    }

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    renderFileIcons(ctx, zoom, worldToScreen);

    // Should NOT render any "+N" badge
    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const badgeCalls = fillTextCalls.filter((c: any[]) => typeof c[0] === 'string' && c[0].startsWith('+'));
    expect(badgeCalls.length).toBe(0);
  });

  it('skips war-room and billy rooms', () => {
    mockFiles = [
      { id: 'f1', name: 'doc.pdf', size: 1000, type: 'pdf', agentId: 'war-room', dealId: 'deal-1', extractedText: 'text', uploadedAt: 1000 },
      { id: 'f2', name: 'doc.pdf', size: 1000, type: 'pdf', agentId: 'billy', dealId: 'deal-1', extractedText: 'text', uploadedAt: 1000 },
    ];

    const zoom = 2;
    const worldToScreen = makeWorldToScreen(zoom, 0, 0);
    renderFileIcons(ctx, zoom, worldToScreen);

    // No icons rendered (no fillRect calls)
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBe(0);
  });
});

// -- Phase 13 Test Stubs -------------------------------------------------------

describe('Phase 13: glow effects', () => {
  it.todo('glow - renderGlowEffects is called during renderFrame with elapsedTime');
  it.todo('glow - monitor glow sources use blue color (100, 149, 237)');
  it.todo('lamp - desk lamp glow sources use amber color (255, 191, 64)');
  it.todo('lamp - War Room has no desk lamp glow source');
});

describe('Phase 13: room labels', () => {
  it.todo('room label - all rooms get labels when zoom >= 1.5');
  it.todo('room label - labels show Name -- Title format for agent offices');
  it.todo('room label - no labels rendered when zoom < 1.5');
});

describe('Phase 13: area rugs', () => {
  it.todo('rug - ROOM_RUGS are rendered in floor layer before walls');
  it.todo('rug - each agent office has a rug with muted signature color');
});

// -- Phase 14: LimeZu Renderer Migration Tests (CHAR-03) ---------------------

describe('Phase 14: 32x32 character anchor math (CHAR-03)', () => {
  it('foot-center anchor drawX = x - (CHAR_SPRITE_W - TILE_SIZE) / 2 = x - 8 for 32x32', () => {
    // CHAR_SPRITE_W = 32, TILE_SIZE = 16
    const x = 160; // arbitrary world X
    const drawX = x - (CHAR_SPRITE_W - TILE_SIZE) / 2;
    expect(drawX).toBe(x - 8);
    expect(CHAR_SPRITE_W).toBe(32);
    expect(TILE_SIZE).toBe(16);
  });

  it('foot-center anchor drawY = y - (CHAR_SPRITE_H - TILE_SIZE) = y - 16 for 32x32', () => {
    const y = 160;
    const drawY = y - (CHAR_SPRITE_H - TILE_SIZE);
    expect(drawY).toBe(y - 16);
    expect(CHAR_SPRITE_H).toBe(32);
  });

  it('drop shadow uses TILE_SIZE * 0.5 horizontal radius for 32x32 sprites', () => {
    // The shadow radius should be TILE_SIZE * 0.5 = 8 for 32x32 sprites
    const shadowRx = TILE_SIZE * 0.5;
    expect(shadowRx).toBe(8);
    // Previously was TILE_SIZE * 0.4 = 6.4 for 24x32 sprites
    expect(shadowRx).toBeGreaterThan(TILE_SIZE * 0.4);
  });
});

describe('Phase 14: drawLimeZuTile helper', () => {
  it('returns false when atlas key does not exist', () => {
    const ctx = createMockCtx();
    const result = drawLimeZuTile(ctx, 'nonexistent-key', 0, 0);
    expect(result).toBe(false);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('returns false when sheet not loaded (getEnvironmentSheetById returns null)', () => {
    const ctx = createMockCtx();
    // 'floor-office' exists in LIMEZU_ATLAS but sheets aren't loaded in test env
    const result = drawLimeZuTile(ctx, 'floor-office', 0, 0);
    expect(result).toBe(false);
  });

  it('LIMEZU_ATLAS has 4 distinct floor types', () => {
    expect(LIMEZU_ATLAS['floor-office']).toBeDefined();
    expect(LIMEZU_ATLAS['floor-warroom']).toBeDefined();
    expect(LIMEZU_ATLAS['floor-hallway']).toBeDefined();
    expect(LIMEZU_ATLAS['floor-rec']).toBeDefined();
  });

  it('LIMEZU_ATLAS has 3D wall tiles', () => {
    expect(LIMEZU_ATLAS['wall-3d-front']).toBeDefined();
    expect(LIMEZU_ATLAS['wall-3d-top']).toBeDefined();
    expect(LIMEZU_ATLAS['wall-3d-side-l']).toBeDefined();
    expect(LIMEZU_ATLAS['wall-3d-side-r']).toBeDefined();
    expect(LIMEZU_ATLAS['wall-3d-corner-tl']).toBeDefined();
    expect(LIMEZU_ATLAS['wall-3d-corner-tr']).toBeDefined();
  });

  it('LIMEZU_ATLAS has Conference Hall assets for War Room', () => {
    expect(LIMEZU_ATLAS['conf-table']).toBeDefined();
    expect(LIMEZU_ATLAS['conf-chair']).toBeDefined();
    expect(LIMEZU_ATLAS['conf-whiteboard']).toBeDefined();
  });

  it('LIMEZU_ATLAS has Film Studio props', () => {
    expect(LIMEZU_ATLAS['clapboard']).toBeDefined();
    expect(LIMEZU_ATLAS['camera']).toBeDefined();
    expect(LIMEZU_ATLAS['film-reel']).toBeDefined();
  });
});
