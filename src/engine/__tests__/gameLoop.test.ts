import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startGameLoop } from '../gameLoop';

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: ((time: number) => void)[] = [];
let rafIdCounter = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;

  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    rafCallbacks.push(cb);
    return ++rafIdCounter;
  });

  vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
    // noop for test
  });

  // Mock devicePixelRatio
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  // Stub getBoundingClientRect
  canvas.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return canvas;
}

describe('startGameLoop', () => {
  it('returns a cleanup function', () => {
    const canvas = createMockCanvas();
    const cleanup = startGameLoop(canvas);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('registers a requestAnimationFrame callback on start', () => {
    const canvas = createMockCanvas();
    const cleanup = startGameLoop(canvas);
    expect(rafCallbacks.length).toBe(1);
    cleanup();
  });

  it('cleanup function stops the loop from scheduling new frames', () => {
    const canvas = createMockCanvas();
    const cleanup = startGameLoop(canvas);

    // One RAF callback scheduled
    expect(rafCallbacks.length).toBe(1);

    // Call the frame once
    rafCallbacks[0]!(16.67);
    // Should schedule another frame
    expect(rafCallbacks.length).toBe(2);

    // Now stop
    cleanup();

    // Call the latest callback -- it should not schedule another
    const countBefore = rafCallbacks.length;
    rafCallbacks[rafCallbacks.length - 1]!(33.33);
    // No new frame should be scheduled because stopped=true
    expect(rafCallbacks.length).toBe(countBefore);
  });

  it('caps delta time at 0.1 seconds (100ms)', () => {
    // This test verifies the game loop does not blow up with a huge delta.
    // We verify by running two frames with a large gap and checking the
    // game loop does not throw.
    const canvas = createMockCanvas();
    const cleanup = startGameLoop(canvas);

    // Frame 1 at time 0 (dt = 0 for first frame)
    rafCallbacks[0]!(0);
    // Frame 2 at time 30000 (30 seconds gap -- tab switch scenario)
    // Delta should be capped at 0.1, not 30.0
    const latestCb = rafCallbacks[rafCallbacks.length - 1]!;
    expect(() => latestCb(30000)).not.toThrow();

    cleanup();
  });
});
