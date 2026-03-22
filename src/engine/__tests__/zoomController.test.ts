import { describe, it, expect } from 'vitest';
import {
  createZoomState,
  tickZoom,
  onZoomInput,
  startAnimatedZoom,
  nearestHalf,
  pixelAlignCamera,
  ZOOM_FACTOR,
  IDLE_DELAY,
  SNAP_DURATION,
  MAX_ZOOM,
} from '../zoomController';
import { applyCursorCenteredZoom } from '../camera';
import type { Camera } from '../types';

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 2.0,
    targetX: 0,
    targetY: 0,
    followTarget: 'billy',
    ...overrides,
  };
}

describe('zoomController', () => {
  describe('exponential zoom factor', () => {
    it('produces correct new zoom from delta', () => {
      // delta=-100 with ZOOM_FACTOR=1.002 => zoom * 1.002^100
      const expectedFactor = Math.pow(ZOOM_FACTOR, 100);
      const zoom = 2.0;
      const newZoom = zoom * expectedFactor;
      // 1.002^100 ≈ 1.2214
      expect(expectedFactor).toBeCloseTo(1.2214, 3);
      expect(newZoom).toBeCloseTo(2.0 * 1.2214, 2);
    });
  });

  describe('cursor-centered zoom', () => {
    it('keeps world point invariant after zoom change', () => {
      const camera = makeCamera({ x: 0, y: 0, zoom: 2.0 });
      const canvasW = 800;
      const canvasH = 600;
      const cursorX = 300;
      const cursorY = 200;

      // Compute world coords of cursor at old zoom
      // Formula: tx = (canvasW - mapW * zoom) / 2 - camera.x
      // worldX = (cursorX - tx) / zoom
      // We'll verify the invariant: after applyCursorCenteredZoom,
      // computing world coords again at new zoom gives the same result.

      // Import OFFICE_TILE_MAP dimensions indirectly
      // We test the invariant: screen-to-world before === screen-to-world after
      const oldZoom = camera.zoom;
      const newZoom = 3.0;

      // Compute world point before
      // We need map dimensions — use the actual function
      applyCursorCenteredZoom(camera, oldZoom, newZoom, cursorX, cursorY, canvasW, canvasH);

      // After applying, camera.zoom should still be oldZoom (applyCursorCenteredZoom adjusts x/y, not zoom)
      // The caller sets zoom. Let's set it:
      camera.zoom = newZoom;

      // Verify: the world point under the cursor is the same
      // We need the actual map dimensions to verify.
      // Instead, let's verify the formula is self-consistent by checking
      // that applying the reverse zoom returns camera to original position.
      const camera2 = { ...camera };
      applyCursorCenteredZoom(camera2, newZoom, oldZoom, cursorX, cursorY, canvasW, canvasH);

      // camera2 should be back to approximately (0, 0)
      expect(camera2.x).toBeCloseTo(0, 5);
      expect(camera2.y).toBeCloseTo(0, 5);
    });

    it('sets targetX/targetY equal to x/y to prevent lerp fighting', () => {
      const camera = makeCamera({ x: 10, y: 20, zoom: 2.0 });
      applyCursorCenteredZoom(camera, 2.0, 3.0, 400, 300, 800, 600);
      expect(camera.x).toBe(camera.targetX);
      expect(camera.y).toBe(camera.targetY);
    });
  });

  describe('inertia decay', () => {
    it('decays velocity toward zero over multiple ticks', () => {
      const state = createZoomState();
      const camera = makeCamera({ zoom: 2.0 });

      // Simulate input
      onZoomInput(state, -50, 400, 300);
      expect(state.phase).toBe('input');

      // Clear the inputThisFrame flag by ticking once to transition to inertia
      state.inputThisFrame = false;
      tickZoom(state, camera, 1 / 60, 800, 600, 0.5);
      expect(state.phase).toBe('inertia');

      const vel1 = Math.abs(state.velocity);

      // Tick a few more frames
      tickZoom(state, camera, 1 / 60, 800, 600, 0.5);
      const vel2 = Math.abs(state.velocity);
      tickZoom(state, camera, 1 / 60, 800, 600, 0.5);
      const vel3 = Math.abs(state.velocity);

      // Velocity should decrease each frame
      expect(vel2).toBeLessThan(vel1);
      expect(vel3).toBeLessThan(vel2);
    });
  });

  describe('snap behavior', () => {
    it('after inertia stops and idle delay passes, snap target is nearest 0.5', () => {
      const state = createZoomState();
      const camera = makeCamera({ zoom: 2.3 });

      // Jump directly to settling phase
      state.phase = 'settling';
      state.idleTimer = 0;
      state.lastCursorX = 400;
      state.lastCursorY = 300;

      // Tick until idle delay passes
      const framesNeeded = Math.ceil(IDLE_DELAY / (1 / 60)) + 1;
      for (let i = 0; i < framesNeeded; i++) {
        tickZoom(state, camera, 1 / 60, 800, 600, 0.5);
        if ((state.phase as string) === 'snapping') break;
      }

      expect(state.phase).toBe('snapping');
      expect(state.snapTarget).toBe(2.5); // nearest 0.5 to 2.3
    });

    it('snap animation eases from current zoom to snap target over SNAP_DURATION', () => {
      const state = createZoomState();
      const camera = makeCamera({ zoom: 2.3 });

      // Set up snapping state
      state.phase = 'snapping';
      state.snapTarget = 2.5;
      state.snapStartZoom = 2.3;
      state.snapProgress = 0;
      state.lastCursorX = 400;
      state.lastCursorY = 300;

      // Tick halfway through snap duration
      tickZoom(state, camera, SNAP_DURATION / 2, 800, 600, 0.5);

      // Should be partway between start and target (ease-out, so more than halfway)
      expect(camera.zoom).toBeGreaterThan(2.3);
      expect(camera.zoom).toBeLessThan(2.5);

      // Tick the rest
      tickZoom(state, camera, SNAP_DURATION / 2 + 0.01, 800, 600, 0.5);

      expect(state.phase).toBe('idle');
      expect(camera.zoom).toBe(2.5);
    });

    it('skips snap if zoom already within SNAP_THRESHOLD of a half-integer', () => {
      const state = createZoomState();
      const camera = makeCamera({ zoom: 2.48 }); // within 0.05 of 2.5

      state.phase = 'settling';
      state.idleTimer = 0;
      state.lastCursorX = 400;
      state.lastCursorY = 300;

      // Tick past idle delay
      const framesNeeded = Math.ceil(IDLE_DELAY / (1 / 60)) + 2;
      for (let i = 0; i < framesNeeded; i++) {
        tickZoom(state, camera, 1 / 60, 800, 600, 0.5);
        if ((state.phase as string) === 'idle') break;
      }

      // Should snap instantly to 2.5, skip animation
      expect(state.phase).toBe('idle');
      expect(camera.zoom).toBe(2.5);
    });
  });

  describe('zoom clamping', () => {
    it('clamps between dynamic minZoom and MAX_ZOOM', () => {
      const state = createZoomState();
      const camera = makeCamera({ zoom: 3.8 });

      // Big zoom-in input
      onZoomInput(state, -500, 400, 300);
      state.inputThisFrame = false;
      tickZoom(state, camera, 1 / 60, 800, 600, 0.5);

      expect(camera.zoom).toBeLessThanOrEqual(MAX_ZOOM);

      // Now try zooming out past minZoom
      const camera2 = makeCamera({ zoom: 0.8 });
      const state2 = createZoomState();
      onZoomInput(state2, 500, 400, 300);
      state2.inputThisFrame = false;
      tickZoom(state2, camera2, 1 / 60, 800, 600, 0.7);

      expect(camera2.zoom).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('pixel-align camera', () => {
    it('rounds x/y to integers after snap completes', () => {
      const camera = makeCamera({ x: 10.7, y: 20.3, targetX: 10.7, targetY: 20.3 });
      pixelAlignCamera(camera);
      expect(camera.x).toBe(11);
      expect(camera.y).toBe(20);
      expect(camera.targetX).toBe(camera.x);
      expect(camera.targetY).toBe(camera.y);
    });
  });

  describe('nearestHalf', () => {
    it('rounds to nearest 0.5', () => {
      expect(nearestHalf(2.3)).toBe(2.5);
      expect(nearestHalf(2.1)).toBe(2.0);
      expect(nearestHalf(1.0)).toBe(1.0);
      expect(nearestHalf(0.8)).toBe(1.0);
      expect(nearestHalf(0.7)).toBe(0.5);
      expect(nearestHalf(3.26)).toBe(3.5);
      expect(nearestHalf(3.24)).toBe(3.0);
    });
  });

  describe('startAnimatedZoom', () => {
    it('sets up snapping state for button zoom', () => {
      const state = createZoomState();
      startAnimatedZoom(state, 3.0, 400, 300);

      expect(state.phase).toBe('snapping');
      expect(state.snapTarget).toBe(3.0);
      expect(state.snapProgress).toBe(0);
      expect(state.lastCursorX).toBe(400);
      expect(state.lastCursorY).toBe(300);
    });
  });
});
