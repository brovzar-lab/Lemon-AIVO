/**
 * Tests for tileStyles serialization round-trip in layoutSerializer.
 * TDD: RED phase — these tests define expected behavior before implementation.
 * serializeLayout() / deserializeLayout() do not yet handle tileStyles.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock IDB — we only test the sync serialize/deserialize logic
vi.mock('idb', () => ({ openDB: vi.fn() }));

// Reset module between tests to get a fresh TILE_STYLES Map
vi.mock('@/engine/officeLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../officeLayout')>();
  return { ...actual };
});

import { serializeLayout, deserializeLayout, exportLayoutJSON, importLayoutJSON, downloadLayoutJSON } from '../layoutSerializer';
import { setTileStyle, TILE_STYLES, FURNITURE, DECORATIONS } from '../officeLayout';

describe('serializeLayout structure', () => {
  beforeEach(() => {
    TILE_STYLES.clear();
  });

  it('includes version, gridCols, gridRows, tileMap, furniture, decorations, rooms, rugs', () => {
    const data = serializeLayout();
    expect(data.version).toBe(1);
    expect(typeof data.gridCols).toBe('number');
    expect(typeof data.gridRows).toBe('number');
    expect(Array.isArray(data.tileMap)).toBe(true);
    expect(Array.isArray(data.furniture)).toBe(true);
    expect(Array.isArray(data.decorations)).toBe(true);
    expect(Array.isArray(data.rooms)).toBe(true);
    expect(Array.isArray(data.rugs)).toBe(true);
  });

  it('tileMap has correct dimensions matching grid', () => {
    const data = serializeLayout();
    expect(data.tileMap).toHaveLength(data.gridRows);
    expect(data.tileMap[0]).toHaveLength(data.gridCols);
  });

  it('furniture array includes entries from FURNITURE', () => {
    const data = serializeLayout();
    expect(data.furniture.length).toBe(FURNITURE.length);
  });

  it('rooms array includes all room definitions', () => {
    const data = serializeLayout();
    expect(data.rooms.length).toBeGreaterThan(0);
    for (const r of data.rooms) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.col).toBe('number');
    }
  });
});

describe('exportLayoutJSON / importLayoutJSON', () => {
  beforeEach(() => {
    TILE_STYLES.clear();
  });

  it('exportLayoutJSON returns valid JSON string', () => {
    const json = exportLayoutJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('importLayoutJSON round-trips exportLayoutJSON output', () => {
    setTileStyle(3, 3, 'floor-wood-dark');
    const json = exportLayoutJSON();
    const data = importLayoutJSON(json);
    expect(data.version).toBe(1);
    expect(Array.isArray(data.tileMap)).toBe(true);
    expect(data.tileStyles?.['3,3']).toBe('floor-wood-dark');
  });

  it('importLayoutJSON throws on invalid JSON', () => {
    expect(() => importLayoutJSON('not json')).toThrow();
  });

  it('importLayoutJSON throws on JSON without version or tileMap', () => {
    expect(() => importLayoutJSON(JSON.stringify({ foo: 'bar' }))).toThrow('Invalid layout file');
  });
});

describe('deserializeLayout full round-trip', () => {
  beforeEach(() => {
    TILE_STYLES.clear();
  });

  it('skips deserialization when grid dimensions mismatch', () => {
    const data = serializeLayout();
    const origFurnitureLength = FURNITURE.length;
    // Corrupt dimensions
    const badData = { ...data, gridRows: 999, gridCols: 999 };
    deserializeLayout(badData);
    // FURNITURE should be unchanged since we bailed out
    expect(FURNITURE.length).toBe(origFurnitureLength);
  });

  it('restores FURNITURE from serialized data', () => {
    const data = serializeLayout();
    const savedLength = data.furniture.length;
    FURNITURE.length = 0;  // Clear furniture
    deserializeLayout(data);
    expect(FURNITURE.length).toBe(savedLength);
  });

  it('restores DECORATIONS from serialized data', () => {
    const baseLength = DECORATIONS.length;
    const data = serializeLayout();
    // Put something extra in DECORATIONS
    DECORATIONS.push({ roomId: 'billy', key: 'test-mug', col: 20, row: 5 });
    const dataWithDeco = serializeLayout();
    DECORATIONS.length = 0;
    deserializeLayout(dataWithDeco);
    expect(DECORATIONS.length).toBe(baseLength + 1);
    expect(DECORATIONS[DECORATIONS.length - 1]!.key).toBe('test-mug');
    // Clean up
    DECORATIONS.length = 0;
    deserializeLayout(data);
  });
});

describe('tileStyles serialization', () => {
  beforeEach(() => {
    TILE_STYLES.clear();
  });

  it('serializeLayout includes tileStyles when Map has entries', () => {
    setTileStyle(5, 3, 'floor-wood-dark');
    const data = serializeLayout();
    expect(data.tileStyles).toBeDefined();
    expect(data.tileStyles!['5,3']).toBe('floor-wood-dark');
  });

  it('serializeLayout omits tileStyles when Map is empty', () => {
    const data = serializeLayout();
    expect(data.tileStyles).toBeUndefined();
  });

  it('deserializeLayout restores tile styles from data', () => {
    const data = serializeLayout();
    // Manually inject tileStyles into the serialized data
    const dataWithStyles = { ...data, tileStyles: { '7,4': 'carpet-blue' } };
    deserializeLayout(dataWithStyles);
    expect(TILE_STYLES.get('7,4')).toBe('carpet-blue');
  });

  it('deserializeLayout clears existing tile styles before restoring', () => {
    // Paint a style in the current session
    setTileStyle(2, 2, 'floor-wood-light');
    expect(TILE_STYLES.has('2,2')).toBe(true);
    // Deserialize a layout with no tileStyles
    const data = serializeLayout();
    TILE_STYLES.clear();  // simulate it was saved before this style
    const dataWithoutStyles = { ...data, tileStyles: undefined };
    deserializeLayout(dataWithoutStyles);
    // The old style should be gone
    expect(TILE_STYLES.has('2,2')).toBe(false);
  });

  it('round-trip: style painted → serialize → deserialize → style restored', () => {
    setTileStyle(10, 8, 'floor-carpet-office');
    const serialized = serializeLayout();
    TILE_STYLES.clear();
    deserializeLayout(serialized);
    expect(TILE_STYLES.get('10,8')).toBe('floor-carpet-office');
  });
});

describe('downloadLayoutJSON', () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let origCreateElement: typeof document.createElement;

  beforeEach(() => {
    TILE_STYLES.clear();
    // Stub URL methods
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    // Spy on anchor click
    clickSpy = vi.fn();
    origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(clickSpy as () => void);
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloadLayoutJSON triggers anchor click with a blob URL', () => {
    downloadLayoutJSON();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
