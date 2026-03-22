/**
 * Ambient glow effects for the office scene.
 *
 * Renders radial gradient halos for monitor screens (blue, pulsing)
 * and desk lamps (amber, static). Glow intensity is modulated by
 * the time-of-day factor so effects are prominent at night and
 * barely visible during the day.
 *
 * Uses Canvas 2D radial gradients with 'lighter' composite mode
 * for additive blending over the scene.
 */
import { TILE_SIZE } from './types';
import { FURNITURE } from './officeLayout';

// ── Glow Source Interface ────────────────────────────────────────────────────

export interface GlowSource {
  /** World-space X coordinate (pixels) */
  x: number;
  /** World-space Y coordinate (pixels) */
  y: number;
  /** Glow radius in pixels */
  radius: number;
  /** RGB color string, e.g. '100, 149, 237' */
  color: string;
  /** Source type */
  type: 'monitor' | 'lamp' | 'ambient';
  /** Whether this source pulses */
  pulse: boolean;
}

// ── Build Glow Sources from Furniture Data ──────────────────────────────────

function buildGlowSources(): GlowSource[] {
  const sources: GlowSource[] = [];

  // Collect desks per room for monitor + lamp placement
  const desksByRoom = new Map<string, typeof FURNITURE[number][]>();
  for (const item of FURNITURE) {
    if (item.type === 'desk') {
      const list = desksByRoom.get(item.roomId) ?? [];
      list.push(item);
      desksByRoom.set(item.roomId, list);
    }
  }

  for (const [roomId, desks] of desksByRoom) {
    if (roomId === 'hallway') continue; // No glow for hallway furniture

    for (const desk of desks) {
      // Monitor glow: centered on desk
      const monitorX = desk.col * TILE_SIZE + (desk.width * TILE_SIZE) / 2;
      const monitorY = desk.row * TILE_SIZE + TILE_SIZE / 2;
      sources.push({
        x: monitorX,
        y: monitorY,
        radius: TILE_SIZE * 2,
        color: '100, 149, 237', // cornflower blue
        type: 'monitor',
        pulse: true,
      });

      // Desk lamp: offset 1 tile to the side (skip war-room)
      if (roomId !== 'war-room') {
        sources.push({
          x: monitorX + TILE_SIZE,
          y: monitorY,
          radius: TILE_SIZE * 2,
          color: '255, 191, 64', // warm amber
          type: 'lamp',
          pulse: false,
        });
      }
    }
  }

  // War Room: single monitor glow at conference table area center
  sources.push({
    x: 15.5 * TILE_SIZE,
    y: 17 * TILE_SIZE,
    radius: TILE_SIZE * 3,
    color: '100, 149, 237',
    type: 'monitor',
    pulse: true,
  });

  // Break Room: warm ambient glow at water cooler (col 20, row 29)
  sources.push({
    x: 20 * TILE_SIZE + TILE_SIZE / 2,
    y: 29 * TILE_SIZE + TILE_SIZE / 2,
    radius: TILE_SIZE * 2,
    color: '255, 191, 64',
    type: 'ambient',
    pulse: false,
  });

  return sources;
}

export const GLOW_SOURCES: GlowSource[] = buildGlowSources();

// ── Render Glow Effects ─────────────────────────────────────────────────────

/**
 * Renders all glow sources using additive radial gradients.
 *
 * @param ctx - Canvas rendering context (in world transform)
 * @param timeOfDay - 0.0 (night) to 1.0 (day) factor
 * @param elapsedTime - Seconds since game start (for pulse animation)
 */
export function renderGlowEffects(
  ctx: CanvasRenderingContext2D,
  timeOfDay: number,
  elapsedTime: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const source of GLOW_SOURCES) {
    // Base alpha: monitors brighter than lamps/ambient
    let alpha = source.type === 'monitor' ? 0.25 : 0.2;

    // Pulse: ~4s full cycle (sin with period = 4s -> freq = PI/2 rad/s)
    if (source.pulse) {
      alpha *= 0.85 + 0.15 * Math.sin(elapsedTime * Math.PI / 2);
    }

    // Day/night modulation: dimmer during the day
    alpha *= 1.0 - timeOfDay * 0.8;

    // Skip near-invisible glows
    if (alpha < 0.005) continue;

    // Radial gradient from center to outer radius
    const grad = ctx.createRadialGradient(
      source.x, source.y, 0,
      source.x, source.y, source.radius,
    );
    grad.addColorStop(0, `rgba(${source.color}, ${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${source.color}, 0)`);

    ctx.fillStyle = grad;
    ctx.fillRect(
      source.x - source.radius,
      source.y - source.radius,
      source.radius * 2,
      source.radius * 2,
    );
  }

  ctx.restore();
}
