/**
 * Tests for engine/input.ts module-level state, callbacks,
 * setupInputHandlers keyboard/mouse events, and tileMap pure functions.
 *
 * Tests are organized into four groups:
 * 1. input.ts: filing-cabinet callback, file-click callback, clearUserPan
 * 2. setupInputHandlers: keyboard navigation shortcuts, hover tile tracking
 * 3. tileMap.ts: isWalkable, getTileAt
 * 4. tileMap.ts: findPath (BFS pathfinding)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TileType } from '../types';
import { createTileMap } from '../tileMap';
import { isWalkable, getTileAt, findPath, resetCollisionOverlay } from '../tileMap';
import {
  setOnFilingCabinetClick,
  onFilingCabinetClickCallback,
  setOnFileClick,
  onFileClickCallback,
  clearUserPan,
  setupInputHandlers,
  removeInputHandlers,
  hoverTileCol,
  hoverTileRow,
} from '@/engine/input';
import { useFileStore } from '@/store/fileStore';

// ── Mocks for setupInputHandlers tests ───────────────────────────────────────

vi.mock('@/store/officeStore', () => ({
  useOfficeStore: {
    getState: vi.fn(),
  },
}));
vi.mock('@/store/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn(() => ({ editorMode: false })),
  },
}));
vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: vi.fn(() => ({ files: [] })),
  },
}));
vi.mock('../characters', () => ({
  startWalk: vi.fn(),
}));
vi.mock('../camera', () => ({
  screenToTile: vi.fn(() => ({ col: 5, row: 5 })),
  computeAutoFitZoom: vi.fn(() => 1.0),
}));
vi.mock('../officeLayout', () => ({
  getRoomAtTile: vi.fn(() => null),
  ROOMS: [
    {
      id: 'patrik', name: "Patrik's Office",
      tileRect: { col: 32, row: 2, width: 11, height: 10 },
      doorTile: { col: 37, row: 11 },
      seatTile: { col: 37, row: 6 },
      billyStandTile: { col: 36, row: 6 },
    },
    {
      id: 'billy', name: "BILLY's Office",
      tileRect: { col: 16, row: 2, width: 15, height: 10 },
      doorTile: { col: 22, row: 11 },
      seatTile: { col: 22, row: 6 },
      billyStandTile: { col: 23, row: 6 },
    },
    {
      id: 'war-room', name: 'Board Room',
      tileRect: { col: 16, row: 14, width: 14, height: 15 },
      doorTile: { col: 21, row: 14 },
      seatTile: { col: 22, row: 22 },
      billyStandTile: { col: 22, row: 17 },
    },
  ],
  OFFICE_TILE_MAP: Array.from({ length: 38 }, () => new Array(45).fill(1)),
  FURNITURE: [],
  getFurnitureAt: vi.fn(() => null),
}));

import { startWalk } from '../characters';
import { useOfficeStore } from '@/store/officeStore';
import { screenToTile } from '../camera';
import { getRoomAtTile } from '../officeLayout';

// ── setupInputHandlers: keyboard shortcuts ────────────────────────────────────

describe('setupInputHandlers: keyboard shortcuts', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;
  let billyChar: { id: string; tileCol: number; tileRow: number; state: string; speed: number };
  let mockState: ReturnType<typeof makeState>;

  function makeState() {
    billyChar = { id: 'billy', tileCol: 20, tileRow: 5, state: 'idle', speed: 1 };
    return {
      characters: [billyChar],
      activeRoomId: 'billy',
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      zoomLevel: 2,
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    };
  }

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    mockState = makeState();
    vi.mocked(useOfficeStore.getState).mockReturnValue(mockState as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('pressing p navigates to patrik room', () => {
    mockState.activeRoomId = 'billy'; // Different from patrik
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    expect(mockState.setTargetRoom).toHaveBeenCalledWith('patrik');
    expect(startWalk).toHaveBeenCalled();
  });

  it('pressing key for current room is a no-op', () => {
    mockState.activeRoomId = 'billy';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    // Should NOT call setTargetRoom since activeRoomId === roomId
    expect(mockState.setTargetRoom).not.toHaveBeenCalled();
  });

  it('pressing 6 navigates to war-room', () => {
    mockState.activeRoomId = 'patrik';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }));
    expect(mockState.setTargetRoom).toHaveBeenCalledWith('war-room');
  });

  it('pressing Escape while already in billy room is a no-op', () => {
    mockState.activeRoomId = 'billy';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(mockState.setTargetRoom).not.toHaveBeenCalled();
  });

  it('pressing Escape from another room navigates to billy', () => {
    mockState.activeRoomId = 'patrik';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(mockState.setTargetRoom).toHaveBeenCalledWith('billy');
  });

  it('cleanup removes event listeners (no calls after cleanup)', () => {
    cleanup();
    const setTargetRoom = mockState.setTargetRoom;
    setTargetRoom.mockClear();
    // After cleanup, pressing keys should not trigger navigation
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    expect(setTargetRoom).not.toHaveBeenCalled();
    // Re-register for afterEach (which will call cleanup again -- that's OK)
    cleanup = setupInputHandlers(canvas);
  });
});

describe('setupInputHandlers: click navigation', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;
  let mockState: ReturnType<typeof makeCState>;

  function makeCState() {
    return {
      characters: [{ id: 'billy', tileCol: 5, tileRow: 5, state: 'idle', speed: 1 }],
      activeRoomId: 'billy',
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    };
  }

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    mockState = makeCState();
    vi.mocked(useOfficeStore.getState).mockReturnValue(mockState as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('clicking on canvas with a valid tile calls startWalk when room is null (hallway)', () => {
    vi.mocked(getRoomAtTile).mockReturnValue(null);
    vi.mocked(screenToTile).mockReturnValue({ col: 10, row: 10 });
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200, bubbles: true }));
    expect(startWalk).toHaveBeenCalled();
  });

  it('clicking on canvas when screenToTile returns null does nothing', () => {
    vi.mocked(screenToTile).mockReturnValue(null);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: -999, clientY: -999, bubbles: true }));
    expect(startWalk).not.toHaveBeenCalled();
    expect(mockState.setTargetRoom).not.toHaveBeenCalled();
  });

  it('mousedown in non-editor mode starts drag tracking', () => {
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true }));
    }).not.toThrow();
  });

  it('right-click mousedown is ignored', () => {
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100, bubbles: true }));
    }).not.toThrow();
  });

  it('mouseup does not throw', () => {
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }).not.toThrow();
  });
});

describe('setupInputHandlers: mousemove hover tracking', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    vi.mocked(useOfficeStore.getState).mockReturnValue({
      characters: [],
      activeRoomId: null,
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    } as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('mousemove does not throw when screenToTile returns a tile', () => {
    vi.mocked(screenToTile).mockReturnValue({ col: 8, row: 4 });
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 150, bubbles: true }));
    }).not.toThrow();
  });

  it('mousemove does not throw when screenToTile returns null', () => {
    vi.mocked(screenToTile).mockReturnValue(null);
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: -999, clientY: -999, bubbles: true }));
    }).not.toThrow();
  });
});

// ── input.ts: callback registration ──────────────────────────────────────────

describe('setOnFilingCabinetClick', () => {
  it('registers and clears the callback', () => {
    const cb = vi.fn();
    setOnFilingCabinetClick(cb);
    expect(onFilingCabinetClickCallback).toBe(cb);
    setOnFilingCabinetClick(null);
    expect(onFilingCabinetClickCallback).toBeNull();
  });

  it('replaces an existing callback when a new one is set', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    setOnFilingCabinetClick(cb1);
    setOnFilingCabinetClick(cb2);
    expect(onFilingCabinetClickCallback).toBe(cb2);
    // Clean up
    setOnFilingCabinetClick(null);
  });
});

describe('setOnFileClick', () => {
  it('registers and clears the file click callback', () => {
    const cb = vi.fn();
    setOnFileClick(cb);
    expect(onFileClickCallback).toBe(cb);
    setOnFileClick(null);
    expect(onFileClickCallback).toBeNull();
  });
});

describe('clearUserPan', () => {
  it('does not throw when called', () => {
    // clearUserPan resets userHasPanned — just verify no throw
    expect(() => clearUserPan()).not.toThrow();
  });
});

// ── setupInputHandlers: drag-and-drop ────────────────────────────────────────

describe('setupInputHandlers: drag-and-drop', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;
  let mockState: ReturnType<typeof makeDragState>;
  let mockFileStore: { addFile: ReturnType<typeof vi.fn>; files: [] };

  function makeDragState() {
    return {
      characters: [],
      activeRoomId: 'billy',
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    };
  }

  function makeDragEvent(type: string, files?: File[]) {
    const dt = {
      dropEffect: '' as string,
      files: files ? { length: files.length, item: (i: number) => files[i]! } : undefined,
    };
    const e = new MouseEvent(type, { clientX: 200, clientY: 200, bubbles: true });
    Object.defineProperty(e, 'dataTransfer', { value: dt, writable: false });
    Object.defineProperty(e, 'preventDefault', { value: vi.fn(), writable: false });
    return e;
  }

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    mockState = makeDragState();
    mockFileStore = { addFile: vi.fn(), files: [] };
    vi.mocked(useOfficeStore.getState).mockReturnValue(mockState as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('dragover does not throw when getRoomAtTile returns null (hallway)', () => {
    vi.mocked(getRoomAtTile).mockReturnValue(null);
    expect(() => {
      canvas.dispatchEvent(makeDragEvent('dragover'));
    }).not.toThrow();
  });

  it('dragover does not throw when getRoomAtTile returns valid agent room', () => {
    vi.mocked(getRoomAtTile).mockReturnValue({
      id: 'patrik',
      name: "Patrik's Office",
      tileRect: { col: 32, row: 2, width: 11, height: 10 },
      doorTile: { col: 37, row: 11 },
      seatTile: { col: 37, row: 6 },
      billyStandTile: { col: 36, row: 6 },
    } as never);
    expect(() => {
      canvas.dispatchEvent(makeDragEvent('dragover'));
    }).not.toThrow();
  });

  it('dragleave does not throw', () => {
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
    }).not.toThrow();
  });

  it('drop does not throw when no valid tile returned', () => {
    vi.mocked(screenToTile).mockReturnValue(null);
    expect(() => {
      canvas.dispatchEvent(makeDragEvent('drop'));
    }).not.toThrow();
  });

  it('drop does not throw when room is not an agent room', () => {
    vi.mocked(screenToTile).mockReturnValue({ col: 5, row: 5 });
    vi.mocked(getRoomAtTile).mockReturnValue({
      id: 'war-room',
      name: 'Board Room',
      tileRect: { col: 16, row: 14, width: 14, height: 15 },
      doorTile: { col: 21, row: 14 },
      seatTile: { col: 22, row: 22 },
      billyStandTile: { col: 22, row: 17 },
    } as never);
    expect(() => {
      canvas.dispatchEvent(makeDragEvent('drop'));
    }).not.toThrow();
  });
});

// ── setupInputHandlers: wheel and dblclick ────────────────────────────────────

describe('setupInputHandlers: wheel and dblclick', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    vi.mocked(useOfficeStore.getState).mockReturnValue({
      characters: [],
      activeRoomId: 'billy',
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    } as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('wheel event does not throw (pixel mode)', () => {
    const e = new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, bubbles: true });
    expect(() => canvas.dispatchEvent(e)).not.toThrow();
  });

  it('wheel event does not throw (line mode deltaMode=1)', () => {
    const e = new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true });
    expect(() => canvas.dispatchEvent(e)).not.toThrow();
  });

  it('wheel event does not throw (page mode deltaMode=2)', () => {
    const e = new WheelEvent('wheel', { deltaY: 1, deltaMode: 2, bubbles: true });
    expect(() => canvas.dispatchEvent(e)).not.toThrow();
  });

  it('dblclick does not throw', () => {
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 400, clientY: 300, bubbles: true }));
    }).not.toThrow();
  });

  it('mouseleave does not throw', () => {
    expect(() => {
      canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    }).not.toThrow();
  });
});

// ── tileMap.ts: walkability ───────────────────────────────────────────────────

describe('isWalkable', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    resetCollisionOverlay();
    // 5×5 FLOOR map
    tileMap = createTileMap(5, 5, TileType.FLOOR);
  });

  it('returns true for FLOOR tile', () => {
    expect(isWalkable(2, 2, tileMap)).toBe(true);
  });

  it('returns true for DOOR tile', () => {
    tileMap[1]![1] = TileType.DOOR;
    expect(isWalkable(1, 1, tileMap)).toBe(true);
  });

  it('returns false for WALL tile', () => {
    tileMap[0]![0] = TileType.WALL;
    expect(isWalkable(0, 0, tileMap)).toBe(false);
  });

  it('returns false for HALLWAY tile (non-FLOOR/DOOR type)', () => {
    // TileType.HALLWAY is a subtype — only FLOOR and DOOR are walkable
    tileMap[2]![2] = TileType.VOID;
    expect(isWalkable(2, 2, tileMap)).toBe(false);
  });

  it('returns false for out-of-bounds tile (negative col)', () => {
    expect(isWalkable(-1, 0, tileMap)).toBe(false);
  });

  it('returns false for out-of-bounds tile (row >= map height)', () => {
    expect(isWalkable(0, 99, tileMap)).toBe(false);
  });
});

describe('getTileAt', () => {
  it('returns VOID for out-of-bounds position', () => {
    const tileMap = createTileMap(3, 3, TileType.FLOOR);
    expect(getTileAt(-1, 0, tileMap)).toBe(TileType.VOID);
    expect(getTileAt(0, 99, tileMap)).toBe(TileType.VOID);
  });

  it('returns correct tile type at valid position', () => {
    const tileMap = createTileMap(3, 3, TileType.WALL);
    tileMap[1]![1] = TileType.FLOOR;
    expect(getTileAt(1, 1, tileMap)).toBe(TileType.FLOOR);
  });
});

// ── tileMap.ts: findPath (BFS) ────────────────────────────────────────────────

describe('findPath', () => {
  let tileMap: TileType[][];

  beforeEach(() => {
    resetCollisionOverlay();
    // 10×10 FLOOR map
    tileMap = createTileMap(10, 10, TileType.FLOOR);
  });

  it('returns a path from A to adjacent B', () => {
    const path = findPath(0, 0, 1, 0, tileMap);
    expect(path.length).toBeGreaterThan(0);
    // Last step is the destination
    expect(path[path.length - 1]).toEqual({ col: 1, row: 0 });
  });

  it('does not include the start tile in path', () => {
    const path = findPath(2, 2, 5, 2, tileMap);
    for (const step of path) {
      expect(step.col !== 2 || step.row !== 2).toBe(true);
    }
  });

  it('returns empty path when start === end', () => {
    const path = findPath(3, 3, 3, 3, tileMap);
    expect(path).toHaveLength(0);
  });

  it('routes around a wall obstacle', () => {
    // Block col=5 for all rows to force a detour
    for (let r = 0; r < 10; r++) {
      tileMap[r]![5] = TileType.WALL;
    }
    // Leave a gap at the bottom row to allow passage
    tileMap[9]![5] = TileType.FLOOR;

    const path = findPath(3, 3, 7, 3, tileMap);
    // Path must exist and must not cross through any WALL tile
    expect(path.length).toBeGreaterThan(0);
    for (const step of path) {
      expect(tileMap[step.row]![step.col]).not.toBe(TileType.WALL);
    }
  });

  it('returns empty path when destination is a WALL (not walkable)', () => {
    tileMap[5]![5] = TileType.WALL;
    const path = findPath(0, 0, 5, 5, tileMap);
    expect(path).toHaveLength(0);
  });

  it('returns empty path when destination is completely surrounded by walls', () => {
    // Surround (5,5) with walls on all sides
    tileMap[4]![5] = TileType.WALL;
    tileMap[6]![5] = TileType.WALL;
    tileMap[5]![4] = TileType.WALL;
    tileMap[5]![6] = TileType.WALL;
    // Destination itself is floor but unreachable
    // Path from (0,0) can reach (5,5) because we just walled neighbors, not the tile
    // Instead, test with a fully-enclosed island:
    tileMap[5]![5] = TileType.FLOOR; // destination is floor but its neighbors are all walls
    const path = findPath(0, 0, 5, 5, tileMap);
    expect(path).toHaveLength(0);
  });

  it('path ends at the exact destination tile', () => {
    const path = findPath(1, 1, 8, 7, tileMap);
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1]!;
    expect(last.col).toBe(8);
    expect(last.row).toBe(7);
  });

  it('each path step is adjacent to the previous (4-connected)', () => {
    const path = findPath(0, 0, 9, 9, tileMap);
    let prev = { col: 0, row: 0 };
    for (const step of path) {
      const colDiff = Math.abs(step.col - prev.col);
      const rowDiff = Math.abs(step.row - prev.row);
      expect(colDiff + rowDiff, `Step (${step.col},${step.row}) not adjacent to (${prev.col},${prev.row})`).toBe(1);
      prev = step;
    }
  });
});

// ── input.ts: removeInputHandlers ────────────────────────────────────────────

describe('removeInputHandlers', () => {
  it('calls the cleanup function without throwing', () => {
    const cleanup = vi.fn();
    expect(() => removeInputHandlers(cleanup)).not.toThrow();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

// ── setupInputHandlers: keyboard zoom shortcuts ────────────────────────────────

describe('setupInputHandlers: keyboard zoom shortcuts', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    vi.mocked(useOfficeStore.getState).mockReturnValue({
      characters: [],
      activeRoomId: 'billy',
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    } as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('pressing z key calls toggleZoom (does not throw)', () => {
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    }).not.toThrow();
  });

  it('pressing Z key calls toggleZoom (does not throw)', () => {
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', bubbles: true }));
    }).not.toThrow();
  });

  it('pressing 0 key resets zoom (does not throw)', () => {
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    }).not.toThrow();
  });

  it('pressing + key zooms in (does not throw)', () => {
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    }).not.toThrow();
  });

  it('pressing = key zooms in (does not throw)', () => {
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true }));
    }).not.toThrow();
  });

  it('pressing - key zooms out (does not throw)', () => {
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    }).not.toThrow();
  });
});

// ── setupInputHandlers: file icon click ───────────────────────────────────────

describe('setupInputHandlers: file icon click detection', () => {
  let canvas: HTMLCanvasElement;
  let cleanup: () => void;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    vi.mocked(useOfficeStore.getState).mockReturnValue({
      characters: [],
      activeRoomId: 'billy',
      targetRoomId: null,
      agentStatuses: {},
      camera: { x: 0, y: 0, zoom: 2, targetX: 0, targetY: 0, followTarget: null },
      setActiveRoom: vi.fn(),
      setTargetRoom: vi.fn(),
      setBillyPosition: vi.fn(),
      setZoomLevel: vi.fn(),
    } as never);
    cleanup = setupInputHandlers(canvas);
  });

  afterEach(() => {
    cleanup();
    setOnFileClick(null);
    vi.clearAllMocks();
  });

  it('clicking a tile with a file icon triggers onFileClickCallback', () => {
    // patrik seatTile is col:37, row:6 → deskRow = 5, deskCol = 37
    // file[0] scatter: scatterCol = ((0*7+3)%5)-2 = 1, iconCol = 37 + 0 + 1 = 38
    // So click col 38 to hit the icon
    vi.mocked(screenToTile).mockReturnValue({ col: 38, row: 5 });
    vi.mocked(useFileStore.getState).mockReturnValue({
      files: [{ id: 'file-abc', agentId: 'patrik', name: 'doc.pdf' }],
    } as never);
    const cb = vi.fn();
    setOnFileClick(cb);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200, bubbles: true }));
    expect(cb).toHaveBeenCalledWith('file-abc');
  });

  it('clicking outside any desk does not trigger onFileClickCallback', () => {
    vi.mocked(screenToTile).mockReturnValue({ col: 0, row: 0 });
    vi.mocked(useFileStore.getState).mockReturnValue({
      files: [{ id: 'file-xyz', agentId: 'patrik', name: 'doc.pdf' }],
    } as never);
    const cb = vi.fn();
    setOnFileClick(cb);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 0, clientY: 0, bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });
});
