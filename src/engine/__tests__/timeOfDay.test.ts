/**
 * Tests for computeTimeOfDay schedule and applyFloorTint tint color selection.
 * Cache isolation: vi.resetModules() + re-import in each test ensures the module-level
 * cacheTimestamp is reset between tests (avoids stale-cache false hits).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('computeTimeOfDay', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('returns 1.0 at 12:00 (midday)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00'));
    // Advance past CACHE_DURATION_MS (10 000ms) so Date.now() > cacheTimestamp
    vi.advanceTimersByTime(15_000);
    const { computeTimeOfDay } = await import('../timeOfDay');
    expect(computeTimeOfDay()).toBe(1.0);
  });

  it('returns 0.0 at 02:00 (night)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T02:00:00'));
    vi.advanceTimersByTime(15_000);
    const { computeTimeOfDay } = await import('../timeOfDay');
    expect(computeTimeOfDay()).toBe(0.0);
  });

  it('returns a value between 0 and 1 at 06:30 (dawn transition)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T06:30:00'));
    vi.advanceTimersByTime(15_000);
    const { computeTimeOfDay } = await import('../timeOfDay');
    const result = computeTimeOfDay();
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('returns a value between 0 and 1 at 18:30 (dusk transition)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T18:30:00'));
    vi.advanceTimersByTime(15_000);
    const { computeTimeOfDay } = await import('../timeOfDay');
    const result = computeTimeOfDay();
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

import { applyFloorTint } from '../timeOfDay';

describe('applyFloorTint', () => {
  function makeCtx() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    return canvas.getContext('2d')!;
  }

  const bounds = { x: 0, y: 0, w: 800, h: 600 };

  it('calls ctx.fillRect with correct bounds', () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(ctx, 'fillRect');
    applyFloorTint(ctx, 0.5, bounds);
    expect(spy).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('uses amber fill color at timeOfDay=1.0 (day)', () => {
    // applyFloorTint calls ctx.save()/restore() so ctx.fillStyle is reset after.
    // We capture fillStyle by spying on fillRect and reading fillStyle at call time.
    const ctx = makeCtx();
    let capturedFillStyle = '';
    vi.spyOn(ctx, 'fillRect').mockImplementation(() => {
      capturedFillStyle = ctx.fillStyle as string;
    });
    applyFloorTint(ctx, 1.0, bounds);
    expect(capturedFillStyle).toBe('#ffd700');
  });

  it('uses dark blue fill color at timeOfDay=0.0 (night)', () => {
    const ctx = makeCtx();
    let capturedFillStyle = '';
    vi.spyOn(ctx, 'fillRect').mockImplementation(() => {
      capturedFillStyle = ctx.fillStyle as string;
    });
    applyFloorTint(ctx, 0.0, bounds);
    expect(capturedFillStyle).toBe('#000020');
  });
});
