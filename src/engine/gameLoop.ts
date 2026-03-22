/**
 * Game loop running on requestAnimationFrame, independent of React render cycle.
 *
 * Reads officeStore via getState() (non-reactive) each frame.
 * Updates camera, then renders. Returns a cleanup function that stops the loop.
 *
 * HiDPI setup happens OUTSIDE this module (in the React mount effect).
 * The game loop receives an already-configured canvas.
 */
import { useOfficeStore } from '@/store/officeStore';
import { useEditorStore } from '@/store/editorStore';
import { updateCamera, computeAutoFitZoom } from './camera';
import { updateAllCharacters } from './characters';
import { OFFICE_TILE_MAP } from './officeLayout';
import { renderFrame } from './renderer';
import { renderEditorOverlay } from './editorRenderer';
import { getAudioManager } from './audioManager';
import { tickZoom, startAnimatedZoom } from './zoomController';
import { zoomState } from './input';
import { initIdleBehaviors, tickIdleBehaviors } from './idleBehaviorManager';
import type { AgentStatus } from '@/types/agent';

/**
 * Starts the game loop on the given canvas element.
 * Returns a cleanup function that stops the loop and cancels the animation frame.
 */
export function startGameLoop(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  if (!ctx) {
    throw new Error('Failed to get 2d context from canvas');
  }

  ctx.imageSmoothingEnabled = false;

  let lastTime = 0;
  let stopped = false;
  let rafId = 0;

  // Track canvas dimensions for resize detection
  let prevWidth = 0;
  let prevHeight = 0;

  // Startup zoom: 2.0x for clean pixel rendering. Auto-fit is the *minimum* zoom bound,
  // not the starting zoom. Users can zoom out to auto-fit, but we don't start there.
  let isAutoFitZoom = false; // start false so user can override; fit-to-screen is auto-fit reset only
  let firstFrame = true;

  // Track quantized zoom to sync store only on 0.5-step changes
  let prevQuantizedZoom = 0;

  // Elapsed time in seconds for glow pulse animation
  let elapsedSeconds = 0;

  // Editor mode transition tracking
  let wasEditing = false;

  // Audio tracking state
  let footstepTimer = 0;
  let prevActiveRoomId: string | null = null;
  let prevAgentStatuses: Record<string, AgentStatus> = {};

  function frame(time: number): void {
    if (stopped) return;

    // Delta time with cap at 100ms to prevent jumps on tab switch
    const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    elapsedSeconds += dt;

    // Read state non-reactively (no re-renders)
    const state = useOfficeStore.getState();

    // Check for canvas resize
    const rect = canvas.getBoundingClientRect();
    if (rect.width !== prevWidth || rect.height !== prevHeight) {
      prevWidth = rect.width;
      prevHeight = rect.height;
      // HiDPI reconfigure
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.imageSmoothingEnabled = false;

      // Recalculate auto-fit zoom on resize (only if user hasn't manually overridden)
      if (isAutoFitZoom && rect.width > 0 && rect.height > 0) {
        const fitZoom = computeAutoFitZoom(rect.width, rect.height);
        if (firstFrame) {
          // First resize: set directly (no point animating initial load)
          state.camera.zoom = fitZoom;
          useOfficeStore.getState().setZoomLevel(fitZoom);
        } else {
          // Subsequent resizes: animate smoothly
          startAnimatedZoom(zoomState, fitZoom, rect.width / 2, rect.height / 2);
        }
      }
    }

    // On first frame, auto-fit zoom so entire office is visible
    if (firstFrame && prevWidth > 0 && prevHeight > 0) {
      firstFrame = false;
      const fitZoom = computeAutoFitZoom(prevWidth, prevHeight);
      state.camera.zoom = fitZoom;
      useOfficeStore.getState().setZoomLevel(fitZoom);

      // Center on map (overview mode)
      state.camera.x = 0;
      state.camera.y = 0;
      state.camera.targetX = 0;
      state.camera.targetY = 0;
    }

    // Expose auto-fit reset via a module-level flag
    if ((globalThis as Record<string, unknown>).__boiler_reset_autofit) {
      (globalThis as Record<string, unknown>).__boiler_reset_autofit = false;
      isAutoFitZoom = true;
      if (prevWidth > 0 && prevHeight > 0) {
        const fitZoom = computeAutoFitZoom(prevWidth, prevHeight);
        startAnimatedZoom(zoomState, fitZoom, prevWidth / 2, prevHeight / 2);
      }
    }

    // Use CSS dimensions (logical pixels) for rendering calculations
    const canvasWidth = prevWidth;
    const canvasHeight = prevHeight;

    // Skip character updates in editor mode (freeze in place)
    const isEditing = useEditorStore.getState().editorMode;
    if (!isEditing) {
      updateAllCharacters(dt, OFFICE_TILE_MAP);
      tickIdleBehaviors(dt);
    }

    // When entering editor mode, auto-fit zoom to show entire office
    if (isEditing && !wasEditing && canvasWidth > 0 && canvasHeight > 0) {
      const fitZoom = computeAutoFitZoom(canvasWidth, canvasHeight);
      state.camera.zoom = fitZoom;
      state.camera.x = 0;
      state.camera.y = 0;
      state.camera.targetX = 0;
      state.camera.targetY = 0;
      useOfficeStore.getState().setZoomLevel(fitZoom);
    }
    wasEditing = isEditing;

    // --- Zoom tick: run state machine each frame ---
    const minZoom = computeAutoFitZoom(canvasWidth, canvasHeight);
    tickZoom(zoomState, state.camera, dt, canvasWidth, canvasHeight, minZoom);

    // Sync store ONLY when quantized zoom changes (prevents React re-render spam)
    const quantized = Math.round(state.camera.zoom * 2) / 2;
    if (quantized !== prevQuantizedZoom) {
      prevQuantizedZoom = quantized;
      useOfficeStore.getState().setZoomLevel(state.camera.zoom);

      // If zoom changed from a non-auto-fit source, mark as manual override
      if (zoomState.phase !== 'idle') {
        isAutoFitZoom = false;
      }
    }

    // --- Audio triggers ---
    const audio = getAudioManager();

    // Footstep SFX: every ~0.3s during BILLY walk state
    const billy = state.characters.find((c) => c.id === 'billy');
    if (billy && billy.state === 'walk') {
      footstepTimer += dt;
      if (footstepTimer >= 0.3) {
        footstepTimer -= 0.3;
        void audio.playSfx('footstep');
      }
    } else {
      footstepTimer = 0;
    }

    // Room change: update ambient volume
    if (state.activeRoomId !== prevActiveRoomId) {
      prevActiveRoomId = state.activeRoomId;
      audio.updateAmbientForRoom(state.activeRoomId);
    }

    // Agent status transitions: chime when 'thinking' -> 'idle'/'needs-attention'
    const currentStatuses = state.agentStatuses ?? {};
    for (const [agentId, currentStatus] of Object.entries(currentStatuses)) {
      const prevStatus = prevAgentStatuses[agentId];
      if (
        prevStatus === 'thinking' &&
        (currentStatus === 'idle' || currentStatus === 'needs-attention')
      ) {
        void audio.playSfx('chime');
      }
    }
    prevAgentStatuses = { ...currentStatuses };

    // Always keep camera centered on the map (overview mode — no follow)
    state.camera.targetX = 0;
    state.camera.targetY = 0;

    // Update camera (smooth follow toward target)
    updateCamera(state.camera, dt, canvasWidth, canvasHeight);

    // Render the frame (pass agentStatuses for canvas status overlays)
    renderFrame(
      ctx,
      state.camera,
      state.characters,
      state.activeRoomId,
      canvasWidth,
      canvasHeight,
      state.agentStatuses,
      elapsedSeconds,
    );

    // Render editor overlay (grid lines, cursor, tile indicators) when editing
    if (isEditing) {
      renderEditorOverlay(ctx, state.camera, canvasWidth, canvasHeight);
    }

    rafId = requestAnimationFrame(frame);
  }

  // Initialize idle behavior state machine (once per game session)
  initIdleBehaviors();

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
