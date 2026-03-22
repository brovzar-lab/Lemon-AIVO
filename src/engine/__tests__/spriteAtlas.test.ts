import { describe, it, expect } from 'vitest';
import { CHARACTER_FRAMES, CHARACTER_SHEET_NAMES } from '../spriteAtlas';
import { LIMEZU_CHARACTER_FRAMES } from '../limeZuCharFrames';

describe('CHARACTER_FRAMES', () => {
  const states: Array<'idle' | 'walk' | 'work' | 'talk'> = ['idle', 'walk', 'work', 'talk'];
  const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

  it('contains entries for all expected states: idle, walk, work, talk', () => {
    for (const state of states) {
      expect(CHARACTER_FRAMES, `missing state: ${state}`).toHaveProperty(state);
    }
  });

  it('each state has all 4 directions: up, down, left, right', () => {
    for (const state of states) {
      for (const dir of directions) {
        expect(CHARACTER_FRAMES[state], `${state} missing ${dir}`).toHaveProperty(dir);
      }
    }
  });

  it('each direction has at least 1 SpriteFrame with valid non-negative x, y, w, h', () => {
    for (const state of states) {
      for (const dir of directions) {
        const frames = CHARACTER_FRAMES[state][dir];
        expect(frames.length, `${state}/${dir}`).toBeGreaterThanOrEqual(1);
        for (const frame of frames) {
          expect(frame.x, `${state}/${dir} frame.x`).toBeGreaterThanOrEqual(0);
          expect(frame.y, `${state}/${dir} frame.y`).toBeGreaterThanOrEqual(0);
          expect(frame.w, `${state}/${dir} frame.w`).toBeGreaterThan(0);
          expect(frame.h, `${state}/${dir} frame.h`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('re-export matches LIMEZU_CHARACTER_FRAMES structure', () => {
    expect(CHARACTER_FRAMES).toBe(LIMEZU_CHARACTER_FRAMES);
  });
});

describe('CHARACTER_SHEET_NAMES', () => {
  const expectedNames = ['billy', 'patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

  it('contains all 7 character IDs', () => {
    for (const name of expectedNames) {
      expect(CHARACTER_SHEET_NAMES, `missing: ${name}`).toContain(name);
    }
  });

  it('has exactly 7 entries', () => {
    expect(CHARACTER_SHEET_NAMES).toHaveLength(7);
  });
});
