/**
 * Zoom state machine with inertia, idle timer, and snap-to-half-integer animation.
 *
 * Manages the full zoom lifecycle: input -> inertia -> settling -> snapping -> idle.
 * Called each frame from the game loop via tickZoom(). Wheel/pinch input flows
 * through onZoomInput(). Button clicks use startAnimatedZoom().
 */
import { applyCursorCenteredZoom } from './camera';
import type { Camera } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Per pixel of deltaY (exponential base) */
export const ZOOM_FACTOR = 1.002;

/** Per-frame velocity decay during inertia */
export const FRICTION = 0.92;

/** Seconds before snap begins after input stops */
export const IDLE_DELAY = 0.15;

/** Snap animation duration in seconds */
export const SNAP_DURATION = 0.25;

/** Skip snap if already this close to a half-integer */
export const SNAP_THRESHOLD = 0.05;

/** Maximum zoom level */
export const MAX_ZOOM = 4.0;

/** Velocity below this is considered stopped */
export const MIN_VELOCITY = 0.001;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ZoomAnimState {
  /** Current zoom velocity (log-space, applied as exponential factor) */
  velocity: number;
  /** Time since last input (seconds) */
  idleTimer: number;
  /** Target half-integer when snapping */
  snapTarget: number | null;
  /** 0..1 ease-out progress */
  snapProgress: number;
  /** Zoom value at snap start (for interpolation) */
  snapStartZoom: number;
  /** State machine phase */
  phase: 'idle' | 'input' | 'inertia' | 'settling' | 'snapping';
  /** Last cursor screen X (for snap animation cursor centering) */
  lastCursorX: number;
  /** Last cursor screen Y */
  lastCursorY: number;
  /** Flag set by onZoomInput, cleared by tickZoom to detect input-vs-no-input frames */
  inputThisFrame: boolean;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/** Creates initial idle zoom state. */
export function createZoomState(): ZoomAnimState {
  return {
    velocity: 0,
    idleTimer: 0,
    snapTarget: null,
    snapProgress: 0,
    snapStartZoom: 0,
    phase: 'idle',
    lastCursorX: 0,
    lastCursorY: 0,
    inputThisFrame: false,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rounds zoom to nearest 0.5 increment. */
export function nearestHalf(zoom: number): number {
  return Math.round(zoom * 2) / 2;
}

/** Rounds camera x/y to integers for pixel-crisp tiles at rest. */
export function pixelAlignCamera(camera: Camera): void {
  camera.x = Math.round(camera.x);
  camera.y = Math.round(camera.y);
  camera.targetX = camera.x;
  camera.targetY = camera.y;
}

// ── Input ────────────────────────────────────────────────────────────────────

/**
 * Called from wheel handler. Converts rawDelta to velocity, sets phase to 'input',
 * stores cursor position. Does NOT directly change camera.zoom (that happens in tickZoom).
 *
 * rawDelta: normalized deltaY (negative = zoom in, positive = zoom out).
 * The sign convention is: positive rawDelta means the user scrolled "up" = zoom in.
 */
export function onZoomInput(
  state: ZoomAnimState,
  rawDelta: number,
  cursorScreenX: number,
  cursorScreenY: number,
): void {
  // Convert delta to log-space velocity
  // rawDelta is already negated by the wheel handler (positive = zoom in)
  state.velocity = rawDelta;
  state.phase = 'input';
  state.lastCursorX = cursorScreenX;
  state.lastCursorY = cursorScreenY;
  state.inputThisFrame = true;
  state.idleTimer = 0;
}

// ── Animated Zoom (button clicks) ────────────────────────────────────────────

/**
 * For button clicks and keyboard shortcuts. Sets up snap animation toward targetZoom.
 */
export function startAnimatedZoom(
  state: ZoomAnimState,
  targetZoom: number,
  cursorScreenX: number,
  cursorScreenY: number,
): void {
  state.snapTarget = targetZoom;
  state.snapProgress = 0;
  state.snapStartZoom = 0; // Will be set on first tick from camera.zoom
  state.phase = 'snapping';
  state.lastCursorX = cursorScreenX;
  state.lastCursorY = cursorScreenY;
  state.velocity = 0;
  state.idleTimer = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────────

/**
 * Called each frame from the game loop. Manages state transitions and applies
 * zoom changes to the camera.
 */
export function tickZoom(
  state: ZoomAnimState,
  camera: Camera,
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
  minZoom: number,
): void {
  switch (state.phase) {
    case 'idle':
      return;

    case 'input': {
      // Apply velocity as exponential zoom factor
      const oldZoom = camera.zoom;
      const factor = Math.pow(ZOOM_FACTOR, state.velocity);
      camera.zoom = clamp(oldZoom * factor, minZoom, MAX_ZOOM);
      if (camera.zoom !== oldZoom) {
        applyCursorCenteredZoom(
          camera, oldZoom, camera.zoom,
          state.lastCursorX, state.lastCursorY,
          canvasWidth, canvasHeight,
        );
      }

      // If no input this frame, transition to inertia
      if (!state.inputThisFrame) {
        state.phase = 'inertia';
      }
      state.inputThisFrame = false;
      break;
    }

    case 'inertia': {
      // Apply friction to velocity
      state.velocity *= FRICTION;

      // Apply velocity as zoom
      const oldZoom = camera.zoom;
      const factor = Math.pow(ZOOM_FACTOR, state.velocity);
      camera.zoom = clamp(oldZoom * factor, minZoom, MAX_ZOOM);
      if (camera.zoom !== oldZoom) {
        applyCursorCenteredZoom(
          camera, oldZoom, camera.zoom,
          state.lastCursorX, state.lastCursorY,
          canvasWidth, canvasHeight,
        );
      }

      // Check if velocity is below threshold
      if (Math.abs(state.velocity) < MIN_VELOCITY) {
        state.velocity = 0;
        state.phase = 'settling';
        state.idleTimer = 0;
      }

      // Check for new input
      if (state.inputThisFrame) {
        state.phase = 'input';
        state.inputThisFrame = false;
      }
      break;
    }

    case 'settling': {
      state.idleTimer += dt;
      if (state.idleTimer >= IDLE_DELAY) {
        const target = nearestHalf(camera.zoom);
        if (Math.abs(camera.zoom - target) < SNAP_THRESHOLD) {
          // Already close enough -- snap instantly + pixel-align
          camera.zoom = target;
          pixelAlignCamera(camera);
          state.phase = 'idle';
        } else {
          // Start snap animation
          state.snapTarget = target;
          state.snapStartZoom = camera.zoom;
          state.snapProgress = 0;
          state.phase = 'snapping';
        }
      }

      // Check for new input
      if (state.inputThisFrame) {
        state.phase = 'input';
        state.inputThisFrame = false;
      }
      break;
    }

    case 'snapping': {
      // Capture start zoom on first tick if not set (from startAnimatedZoom)
      if (state.snapStartZoom === 0) {
        state.snapStartZoom = camera.zoom;
      }

      state.snapProgress = Math.min(1, state.snapProgress + dt / SNAP_DURATION);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - state.snapProgress, 3);

      const oldZoom = camera.zoom;
      camera.zoom = state.snapStartZoom + (state.snapTarget! - state.snapStartZoom) * eased;
      camera.zoom = clamp(camera.zoom, minZoom, MAX_ZOOM);

      // Apply cursor-centered zoom for smooth tracking during snap
      if (camera.zoom !== oldZoom) {
        applyCursorCenteredZoom(
          camera, oldZoom, camera.zoom,
          state.lastCursorX, state.lastCursorY,
          canvasWidth, canvasHeight,
        );
      }

      if (state.snapProgress >= 1) {
        camera.zoom = clamp(state.snapTarget!, minZoom, MAX_ZOOM);
        pixelAlignCamera(camera);
        state.phase = 'idle';
      }

      // Check for new input (interrupt snap)
      if (state.inputThisFrame) {
        state.phase = 'input';
        state.inputThisFrame = false;
      }
      break;
    }
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
