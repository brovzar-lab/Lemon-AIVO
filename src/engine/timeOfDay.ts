/**
 * Day/night cycle system based on the user's system clock.
 *
 * Computes a 0.0 (full night) to 1.0 (full day) factor and provides
 * a floor tint overlay that shifts from warm amber (day) to dark
 * blue-black (night) with gradual dawn/dusk transitions.
 *
 * The time-of-day value is cached for 10 seconds to avoid
 * recalculating every frame (Date construction is surprisingly costly).
 */

// ── Cached Time-of-Day ──────────────────────────────────────────────────────

let cachedTimeOfDay = 0;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 10_000; // 10 seconds

/**
 * Returns a 0.0 (night) to 1.0 (day) factor based on the current system time.
 *
 * Schedule:
 *   Night (0.0):  19:00 - 06:00
 *   Dawn  (0->1): 06:00 - 07:00  (gradual transition)
 *   Day   (1.0):  07:00 - 18:00
 *   Dusk  (1->0): 18:00 - 19:00  (gradual transition)
 */
export function computeTimeOfDay(): number {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedTimeOfDay;
  }

  const date = new Date();
  const h = date.getHours() + date.getMinutes() / 60;

  let factor: number;
  if (h >= 7 && h < 18) {
    // Full day
    factor = 1.0;
  } else if (h >= 6 && h < 7) {
    // Dawn: 6am to 7am
    factor = h - 6;
  } else if (h >= 18 && h < 19) {
    // Dusk: 6pm to 7pm
    factor = 1.0 - (h - 18);
  } else {
    // Night
    factor = 0.0;
  }

  cachedTimeOfDay = factor;
  cacheTimestamp = now;
  return factor;
}

// ── Floor Tint ──────────────────────────────────────────────────────────────

/**
 * Applies a subtle color tint over the visible floor area.
 *
 * - During the day (timeOfDay > 0.5): warm amber overlay (#ffd700), max ~3% opacity.
 * - During the night (timeOfDay <= 0.5): dark blue-black overlay (#000020), max ~7.5% opacity.
 *
 * @param ctx - Canvas rendering context (in world transform)
 * @param timeOfDay - 0.0 (night) to 1.0 (day) factor
 * @param bounds - Visible area in world pixels { x, y, w, h }
 */
export function applyFloorTint(
  ctx: CanvasRenderingContext2D,
  timeOfDay: number,
  bounds: { x: number; y: number; w: number; h: number },
): void {
  ctx.save();

  if (timeOfDay > 0.5) {
    // Day: warm amber tint
    ctx.globalAlpha = (timeOfDay - 0.5) * 0.06; // max 3% at full day
    ctx.fillStyle = '#ffd700';
  } else {
    // Night: dark blue-black tint
    ctx.globalAlpha = (0.5 - timeOfDay) * 0.15; // max 7.5% at full night
    ctx.fillStyle = '#000020';
  }

  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
}
