import { describe, it, expect } from 'vitest';
import { SHEET_PATHS, LIMEZU_ATLAS, FURNITURE_48_SHEET_PATHS, FURNITURE_COMPILED_SHEET_PATHS, sf } from '../limeZuAtlas';

import { LIMEZU_CHARACTER_FRAMES, CHAR_SHEET_PATHS } from '../limeZuCharFrames';
import { CHAR_SPRITE_W, CHAR_SPRITE_H } from '../types';

// ── Dimension Constants ──────────────────────────────────────────────────────

describe('Dimension constants', () => {
  it('CHAR_SPRITE_W is 32 (Metro City character frame width)', () => {
    expect(CHAR_SPRITE_W).toBe(32);
  });

  it('CHAR_SPRITE_H is 32 (Metro City single-cell character frames)', () => {
    expect(CHAR_SPRITE_H).toBe(32);
  });
});

// ── SHEET_PATHS ──────────────────────────────────────────────────────────────

describe('SHEET_PATHS', () => {
  const expectedKeys = [
    'generic', 'living-room', 'classroom', 'conference', 'film-studio',
    'floors', 'walls', '3d-walls', 'baseboards', 'floor-shadows',
    'ui', 'ui-emotes',
  ];

  it('contains all required LimeZu sheet keys', () => {
    for (const key of expectedKeys) {
      expect(SHEET_PATHS).toHaveProperty(key);
    }
    expect(Object.keys(SHEET_PATHS).length).toBeGreaterThanOrEqual(12);
  });

  it('LimeZu paths start with /sprites/modern-interiors-paid/', () => {
    for (const key of expectedKeys) {
      const path = SHEET_PATHS[key];
      expect(path, `${key} path`).toMatch(/^\/sprites\/modern-interiors-paid\//);
    }
  });
});

// ── LIMEZU_ATLAS ─────────────────────────────────────────────────────────────

describe('LIMEZU_ATLAS', () => {
  it('has at least 40 entries', () => {
    expect(Object.keys(LIMEZU_ATLAS).length).toBeGreaterThanOrEqual(40);
  });

  it('all entries reference valid sheetId in SHEET_PATHS or FURNITURE_48_SHEET_PATHS', () => {
    for (const [key, entry] of Object.entries(LIMEZU_ATLAS)) {
      const inEager    = Object.prototype.hasOwnProperty.call(SHEET_PATHS, entry.sheetId);
      const inLazy     = Object.prototype.hasOwnProperty.call(FURNITURE_48_SHEET_PATHS, entry.sheetId);
      const inCompiled = Object.prototype.hasOwnProperty.call(FURNITURE_COMPILED_SHEET_PATHS, entry.sheetId);
      expect(inEager || inLazy || inCompiled, `${key} references unknown sheetId: ${entry.sheetId}`).toBe(true);
    }
  });

  it('all frame coordinates are non-negative (w/h=0 allowed for full-image Singles)', () => {
    for (const [key, entry] of Object.entries(LIMEZU_ATLAS)) {
      expect(entry.frame.x, `${key}.x`).toBeGreaterThanOrEqual(0);
      expect(entry.frame.y, `${key}.y`).toBeGreaterThanOrEqual(0);
      // w=0 and h=0 are the full-image sentinel for 48×48 Singles entries
      expect(entry.frame.w, `${key}.w`).toBeGreaterThanOrEqual(0);
      expect(entry.frame.h, `${key}.h`).toBeGreaterThanOrEqual(0);
    }
  });

  // Floor keys
  it('contains floor keys', () => {
    expect(LIMEZU_ATLAS).toHaveProperty('floor-office');
    expect(LIMEZU_ATLAS).toHaveProperty('floor-warroom');
    expect(LIMEZU_ATLAS).toHaveProperty('floor-hallway');
    expect(LIMEZU_ATLAS).toHaveProperty('floor-rec');
  });

  // 3D wall keys
  it('contains wall keys for 3D wall tiles', () => {
    expect(LIMEZU_ATLAS).toHaveProperty('wall-3d-top');
    expect(LIMEZU_ATLAS).toHaveProperty('wall-3d-front');
  });

  // Furniture keys
  it('contains all required furniture keys', () => {
    const furnitureKeys = [
      'desk-wood-2wide', 'desk-wood-3wide', 'chair-office',
      'bookshelf-2tall', 'table-conference', 'monitor',
      'couch-2wide', 'plant-potted', 'water-cooler', 'filing-cabinet',
    ];
    for (const key of furnitureKeys) {
      expect(LIMEZU_ATLAS, `missing furniture key: ${key}`).toHaveProperty(key);
    }
  });

  // War Room keys
  it('contains War Room keys', () => {
    expect(LIMEZU_ATLAS).toHaveProperty('conf-table');
    expect(LIMEZU_ATLAS).toHaveProperty('conf-chair');
    expect(LIMEZU_ATLAS).toHaveProperty('whiteboard');
  });

  // Decoration keys
  it('contains decoration keys matching personality items', () => {
    const decorKeys = [
      'patrik-chart', 'marcos-lawbooks', 'sandra-whiteboard',
      'isaac-corkboard', 'wendy-plant', 'billy-clapboard',
    ];
    for (const key of decorKeys) {
      expect(LIMEZU_ATLAS, `missing decoration key: ${key}`).toHaveProperty(key);
    }
  });

  // UI keys
  it('contains UI keys', () => {
    expect(LIMEZU_ATLAS).toHaveProperty('emote-thinking');
    expect(LIMEZU_ATLAS).toHaveProperty('emote-exclamation');
    expect(LIMEZU_ATLAS).toHaveProperty('speech-bubble-left');
    expect(LIMEZU_ATLAS).toHaveProperty('speech-bubble-right');
  });

  // Film Studio keys
  it('contains film studio keys', () => {
    expect(LIMEZU_ATLAS).toHaveProperty('clapboard');
    expect(LIMEZU_ATLAS).toHaveProperty('camera');
    expect(LIMEZU_ATLAS).toHaveProperty('film-reel');
    expect(LIMEZU_ATLAS).toHaveProperty('director-chair');
  });
});

// ── sf helper ────────────────────────────────────────────────────────────────

describe('sf helper', () => {
  it('creates a SheetFrame with default 1x1 tile size', () => {
    const result = sf('generic', 2, 3);
    expect(result).toEqual({
      sheetId: 'generic',
      frame: { x: 32, y: 48, w: 16, h: 16 },
    });
  });

  it('creates a SheetFrame with custom width and height', () => {
    const result = sf('generic', 0, 0, 3, 2);
    expect(result).toEqual({
      sheetId: 'generic',
      frame: { x: 0, y: 0, w: 48, h: 32 },
    });
  });
});

// ── LIMEZU_CHARACTER_FRAMES ──────────────────────────────────────────────────

describe('LIMEZU_CHARACTER_FRAMES', () => {
  const states: Array<'idle' | 'walk' | 'work' | 'talk'> = ['idle', 'walk', 'work', 'talk'];
  const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

  it('has entries for all 4 states', () => {
    for (const state of states) {
      expect(LIMEZU_CHARACTER_FRAMES, `missing state: ${state}`).toHaveProperty(state);
    }
  });

  it('each state has all 4 directions', () => {
    for (const state of states) {
      for (const dir of directions) {
        expect(LIMEZU_CHARACTER_FRAMES[state], `${state} missing direction: ${dir}`).toHaveProperty(dir);
      }
    }
  });

  it('each direction has at least 1 SpriteFrame', () => {
    for (const state of states) {
      for (const dir of directions) {
        const frames = LIMEZU_CHARACTER_FRAMES[state][dir];
        expect(frames.length, `${state}/${dir} has no frames`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('all frames have valid non-negative coordinates', () => {
    for (const state of states) {
      for (const dir of directions) {
        for (const frame of LIMEZU_CHARACTER_FRAMES[state][dir]) {
          expect(frame.x, `${state}/${dir} x`).toBeGreaterThanOrEqual(0);
          expect(frame.y, `${state}/${dir} y`).toBeGreaterThanOrEqual(0);
          expect(frame.w, `${state}/${dir} w`).toBe(32);
          expect(frame.h, `${state}/${dir} h`).toBe(32);
        }
      }
    }
  });

  it('walk has multiple frames per direction (for animation)', () => {
    for (const dir of directions) {
      expect(LIMEZU_CHARACTER_FRAMES.walk[dir].length, `walk/${dir}`).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── CHAR_SHEET_PATHS ─────────────────────────────────────────────────────────

describe('CHAR_SHEET_PATHS', () => {
  const characterIds = ['billy', 'patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

  it('contains all 7 character IDs', () => {
    for (const id of characterIds) {
      expect(CHAR_SHEET_PATHS, `missing character: ${id}`).toHaveProperty(id);
    }
    expect(Object.keys(CHAR_SHEET_PATHS)).toHaveLength(7);
  });

  it('all paths reference Metro City composited PNG files', () => {
    for (const [id, path] of Object.entries(CHAR_SHEET_PATHS)) {
      expect(path, `${id} path`).toMatch(/\/sprites\/metro\/\w+\.png$/);
    }
  });
});
