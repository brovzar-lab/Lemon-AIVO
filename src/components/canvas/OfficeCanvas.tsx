import { useRef, useEffect } from 'react';
import { useOfficeStore } from '@/store/officeStore';
import { startGameLoop } from '@/engine/gameLoop';
import { setupInputHandlers } from '@/engine/input';
import { loadAllAssets } from '@/engine/spriteSheet';

/**
 * Pixel-Art Office Canvas — powered by the full game engine.
 *
 * On mount:
 *   1. Initializes all 7 characters (Billy + 6 agents) in the store
 *   2. Starts the game loop immediately (shows fallback colors while sprites load)
 *   3. Attaches input handlers (click-to-walk, zoom, drag-pan, keyboard, D&D)
 *   4. Loads all sprite sheets in background (renderer auto-upgrades on load)
 *
 * The canvas fills its container. The game loop handles HiDPI scaling and
 * canvas resize automatically.
 */
export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Initialize characters (Billy + agents) in the store BEFORE game loop
    //    so the first rendered frame shows characters
    const state = useOfficeStore.getState();
    if (state.characters.length === 0) {
      state.initializeCharacters();
    }

    // 2. Start the game loop immediately — it renders fallback colored
    //    rectangles until sprite sheets finish loading
    const stopGameLoop = startGameLoop(canvas);

    // 3. Attach input handlers — click-to-walk, keyboard navigation,
    //    drag-to-pan, pinch/wheel zoom, file drag-and-drop
    const removeInput = setupInputHandlers(canvas);

    // 4. Load all sprite sheets in the background
    //    The renderer auto-upgrades to sprites when getCharacterSheet() stops returning null
    void loadAllAssets();

    return () => {
      removeInput();
      stopGameLoop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="office-canvas"
      tabIndex={0}
      style={{
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        display: 'block',
        outline: 'none',
      }}
    />
  );
}
