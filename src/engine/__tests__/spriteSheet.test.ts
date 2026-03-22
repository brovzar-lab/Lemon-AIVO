import { describe, it, expect } from 'vitest';
import { getQuantizedZoom, getEnvironmentSheetById } from '../spriteSheet';
import { CHARACTER_SHEET_NAMES } from '../spriteAtlas';

describe('getQuantizedZoom', () => {
  it('returns 1.0 for exact half-integer 1.0', () => {
    expect(getQuantizedZoom(1.0)).toBe(1.0);
  });

  it('rounds 1.3 up to nearest 0.5 (1.5)', () => {
    expect(getQuantizedZoom(1.3)).toBe(1.5);
  });

  it('rounds 1.2 down to nearest 0.5 (1.0)', () => {
    expect(getQuantizedZoom(1.2)).toBe(1.0);
  });

  it('rounds 0.75 to 1.0 (nearest 0.5)', () => {
    expect(getQuantizedZoom(0.75)).toBe(1.0);
  });

  it('rounds 2.74 to 2.5 and 2.76 to 3.0', () => {
    expect(getQuantizedZoom(2.74)).toBe(2.5);
    expect(getQuantizedZoom(2.76)).toBe(3.0);
  });

  it('returns 0.5 for sub-1.0 half-integer', () => {
    expect(getQuantizedZoom(0.5)).toBe(0.5);
  });

  it('preserves exact half-integers (1.5, 2.0, 2.5, 3.0)', () => {
    expect(getQuantizedZoom(1.5)).toBe(1.5);
    expect(getQuantizedZoom(2.0)).toBe(2.0);
    expect(getQuantizedZoom(2.5)).toBe(2.5);
    expect(getQuantizedZoom(3.0)).toBe(3.0);
  });

  it('produces stable cache keys (same input always same output)', () => {
    const zoom = 1.7777;
    const key1 = getQuantizedZoom(zoom);
    const key2 = getQuantizedZoom(zoom);
    const key3 = getQuantizedZoom(zoom);
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
    expect(key1).toBe(2.0);
  });
});

describe('getEnvironmentSheetById', () => {
  it('returns null for unknown sheetId before any loading', () => {
    expect(getEnvironmentSheetById('nonexistent-sheet')).toBeNull();
  });

  it('returns null for empty string sheetId', () => {
    expect(getEnvironmentSheetById('')).toBeNull();
  });
});

describe('CHARACTER_SHEET_NAMES', () => {
  const expectedNames = ['billy', 'patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

  it('contains all 7 character IDs', () => {
    for (const name of expectedNames) {
      expect(CHARACTER_SHEET_NAMES, `missing character: ${name}`).toContain(name);
    }
  });

  it('has exactly 7 entries', () => {
    expect(CHARACTER_SHEET_NAMES).toHaveLength(7);
  });
});
