/**
 * Pixel-art sprite drawing functions — all office furniture, characters, and decorations.
 * Ported from TEST PIXEL TEAM's sprites.js (694 lines → TypeScript)
 */
import { P } from './palette';
import { drawSpriteFrame, getSheet } from './pixelSpriteAnimator';


// ─── Room type from layout ───
export interface RoomRect {
  x: number; y: number; w: number; h: number;
  door?: { side: 'top' | 'bottom' | 'left' | 'right'; pos: number };
  type?: string;
}

// ─── Agent appearance config ───
export interface AgentAppearance {
  name: string;
  role: string;
  hair: string;
  shirt: string;
  status: string;
}

// ─── Utility ───
export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

// ─── Room Base (enhanced with wall texture + floor grain) ───
export function drawRoomBase(ctx: CanvasRenderingContext2D, r: RoomRect, wallColor: string, floorColor: string): void {
  const wallH = Math.round(r.h * 0.32);
  rect(ctx, r.x, r.y, r.w, 6, P.border);
  rect(ctx, r.x, r.y + 6, r.w, wallH - 6, wallColor);
  rect(ctx, r.x, r.y + 6, r.w, 2, P.wallTealLight);
  for (let wx = r.x + 12; wx < r.x + r.w; wx += 24) {
    rect(ctx, wx, r.y + 10, 2, wallH - 16, P.wallTealDark);
  }
  rect(ctx, r.x, r.y + wallH - 6, r.w, 6, P.deskDark);
  rect(ctx, r.x, r.y + wallH - 8, r.w, 2, P.deskWood);
  rect(ctx, r.x, r.y + wallH, r.w, r.h - wallH, floorColor);
  for (let py = r.y + wallH + 16; py < r.y + r.h; py += 16) {
    rect(ctx, r.x, py, r.w, 2, P.floorWoodPlank);
    const offset = ((py - r.y) % 32 === 0) ? 60 : 140;
    rect(ctx, r.x + offset, py - 8, 2, 8, P.floorWoodDark);
    rect(ctx, r.x + offset + 120, py - 8, 2, 8, P.floorWoodDark);
  }
  rect(ctx, r.x, r.y + wallH, r.w, 4, P.floorWoodDark);
}

// ─── Room Walls (thin brown border with door opening) ───
export function drawRoomWalls(ctx: CanvasRenderingContext2D, r: RoomRect): void {
  const T = 6;
  const doorW = 36;
  const d = r.door;
  if (!d) return;

  const gapCenter = d.side === 'top' || d.side === 'bottom'
    ? r.x + Math.round(r.w * d.pos)
    : r.y + Math.round(r.h * d.pos);
  const gapHalf = Math.floor(doorW / 2);

  if (d.side === 'top') {
    rect(ctx, r.x, r.y, gapCenter - gapHalf - r.x, T, P.wallBrown);
    rect(ctx, gapCenter + gapHalf, r.y, r.x + r.w - gapCenter - gapHalf, T, P.wallBrown);
    rect(ctx, gapCenter - gapHalf - 2, r.y, 2, T, P.wallBrownLight);
    rect(ctx, gapCenter + gapHalf, r.y, 2, T, P.wallBrownLight);
  } else {
    rect(ctx, r.x, r.y, r.w, T, P.wallBrown);
  }

  if (d.side === 'bottom') {
    rect(ctx, r.x, r.y + r.h - T, gapCenter - gapHalf - r.x, T, P.wallBrown);
    rect(ctx, gapCenter + gapHalf, r.y + r.h - T, r.x + r.w - gapCenter - gapHalf, T, P.wallBrown);
    rect(ctx, gapCenter - gapHalf - 2, r.y + r.h - T, 2, T, P.wallBrownLight);
    rect(ctx, gapCenter + gapHalf, r.y + r.h - T, 2, T, P.wallBrownLight);
  } else {
    rect(ctx, r.x, r.y + r.h - T, r.w, T, P.wallBrown);
  }

  if (d.side === 'left') {
    rect(ctx, r.x, r.y, T, gapCenter - gapHalf - r.y, P.wallBrown);
    rect(ctx, r.x, gapCenter + gapHalf, T, r.y + r.h - gapCenter - gapHalf, P.wallBrown);
    rect(ctx, r.x, gapCenter - gapHalf - 2, T, 2, P.wallBrownLight);
    rect(ctx, r.x, gapCenter + gapHalf, T, 2, P.wallBrownLight);
  } else {
    rect(ctx, r.x, r.y, T, r.h, P.wallBrown);
  }

  if (d.side === 'right') {
    rect(ctx, r.x + r.w - T, r.y, T, gapCenter - gapHalf - r.y, P.wallBrown);
    rect(ctx, r.x + r.w - T, gapCenter + gapHalf, T, r.y + r.h - gapCenter - gapHalf, P.wallBrown);
    rect(ctx, r.x + r.w - T, gapCenter - gapHalf - 2, T, 2, P.wallBrownLight);
    rect(ctx, r.x + r.w - T, gapCenter + gapHalf, T, 2, P.wallBrownLight);
  } else {
    rect(ctx, r.x + r.w - T, r.y, T, r.h, P.wallBrown);
  }

  if (d.side !== 'top') rect(ctx, r.x, r.y, r.w, 2, P.wallBrownLight);
  if (d.side !== 'left') rect(ctx, r.x, r.y, 2, r.h, P.wallBrownLight);
}

// ─── Desk (L-shaped with drawers, keyboard, depth) ───
export function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, facing: 'left' | 'right' = 'right'): void {
  rect(ctx, x + 4, y + h + 4, 4, 4, P.deskDark);
  rect(ctx, x + w - 8, y + h + 4, 4, 4, P.deskDark);
  rect(ctx, x, y, w, h, P.deskWood);
  rect(ctx, x + 2, y + 2, w - 4, h - 6, P.deskLight);
  rect(ctx, x + 8, y + 4, w - 16, 2, P.deskWood);
  rect(ctx, x + 12, y + h - 8, w - 24, 2, P.deskWood);
  rect(ctx, x, y + h, w, 6, P.deskDark);
  rect(ctx, x + 2, y + h, w - 4, 2, P.deskWood);
  rect(ctx, x + w / 2 - 12, y + h, 24, 6, P.deskDark);
  rect(ctx, x + w / 2 - 2, y + h + 2, 4, 2, P.cabinetGray);
  if (facing === 'right') {
    rect(ctx, x + w - 24, y - 28, 24, 28, P.deskWood);
    rect(ctx, x + w - 22, y - 26, 20, 24, P.deskLight);
    rect(ctx, x + w - 24, y, 24, 4, P.deskDark);
  } else {
    rect(ctx, x, y - 28, 24, 28, P.deskWood);
    rect(ctx, x + 2, y - 26, 20, 24, P.deskLight);
    rect(ctx, x, y, 24, 4, P.deskDark);
  }
  const kx = x + (facing === 'right' ? 16 : w - 40);
  rect(ctx, kx, y + h - 12, 24, 8, P.monitorGray);
  rect(ctx, kx + 2, y + h - 10, 20, 4, P.cabinetDark);
  rect(ctx, kx + 28, y + h - 10, 6, 6, P.monitorGray);
}

// ─── Monitor ───
export function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, screenColor?: string): void {
  const sc = screenColor || P.screenBlue;
  rect(ctx, x + 6, y + 24, 12, 4, P.monitorGray);
  rect(ctx, x + 2, y + 26, 20, 4, P.cabinetDark);
  rect(ctx, x + 10, y + 20, 4, 6, P.monitorGray);
  rect(ctx, x, y, 24, 22, P.monitorGray);
  rect(ctx, x, y, 24, 2, P.cabinetDark);
  rect(ctx, x + 2, y + 2, 20, 16, sc);
  rect(ctx, x + 4, y + 4, 6, 2, P.textWhite);
  rect(ctx, x + 4, y + 8, 10, 2, '#80d0a0');
  rect(ctx, x + 4, y + 12, 8, 2, P.screenGreen);
  rect(ctx, x + 14, y + 6, 4, 8, P.bookYellow);
  ctx.globalAlpha = 0.15;
  rect(ctx, x + 14, y + 2, 6, 6, P.textWhite);
  ctx.globalAlpha = 1;
}

// ─── Chair ───
export function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, color?: string): void {
  const c = color || P.chairBrown;
  rect(ctx, x + 2, y + 16, 4, 4, P.cabinetDark);
  rect(ctx, x + 10, y + 16, 4, 4, P.cabinetDark);
  rect(ctx, x, y + 6, 16, 10, c);
  rect(ctx, x + 2, y + 8, 12, 6, P.chairDark);
  rect(ctx, x + 2, y, 12, 8, c);
  rect(ctx, x + 4, y + 2, 8, 4, P.chairDark);
  rect(ctx, x - 2, y + 4, 4, 8, c);
  rect(ctx, x + 14, y + 4, 4, 8, c);
}

// ─── Filing Cabinet ───
export function drawFilingCabinet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x + 2, y + 46, 28, 4, P.border);
  rect(ctx, x, y, 28, 46, P.cabinetGray);
  rect(ctx, x, y, 28, 4, P.floorTileLight);
  rect(ctx, x + 26, y, 2, 46, P.cabinetDark);
  for (let i = 0; i < 3; i++) {
    const dy = y + 6 + i * 14;
    rect(ctx, x + 2, dy, 24, 12, P.cabinetDark);
    rect(ctx, x + 4, dy + 2, 20, 8, P.cabinetGray);
    rect(ctx, x + 10, dy + 4, 8, 4, P.floorTileLight);
    rect(ctx, x + 12, dy + 4, 4, 2, P.textWhite);
  }
  rect(ctx, x + 6, y + 8, 12, 4, P.textWhite);
}

// ─── Bookshelf ───
export function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x + 2, y + 60, 44, 4, P.border);
  rect(ctx, x, y, 44, 60, P.shelfWood);
  rect(ctx, x + 2, y + 2, 40, 56, P.shelfDark);
  rect(ctx, x, y, 44, 4, P.deskLight);
  const bookColors = [P.bookRed, P.bookBlue, P.bookGreen, P.bookYellow,
    '#6a4488', '#884444', P.bookBlue, P.bookRed, '#448844'];
  for (let s = 0; s < 3; s++) {
    const sy = y + 6 + s * 18;
    rect(ctx, x + 2, sy + 14, 40, 4, P.shelfWood);
    let bx = x + 4;
    for (let b = 0; b < 6 && bx < x + 40; b++) {
      const bw = 4 + (b % 3 === 0 ? 2 : 0);
      const bh = 10 + (b % 2) * 2;
      rect(ctx, bx, sy + (14 - bh), bw, bh, bookColors[(s * 6 + b) % bookColors.length]!);
      rect(ctx, bx, sy + (14 - bh), 2, bh, P.textWhite);
      ctx.globalAlpha = 0.15;
      rect(ctx, bx, sy + (14 - bh), 2, bh, P.textWhite);
      ctx.globalAlpha = 1;
      bx += bw + 2;
    }
  }
}

// ─── Plant ───
export function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, size?: number): void {
  const s = size || 1;
  ctx.globalAlpha = 0.3;
  rect(ctx, x + 2 * s, y + 28 * s, 16 * s, 4 * s, P.border);
  ctx.globalAlpha = 1;
  rect(ctx, x + 4 * s, y + 16 * s, 12 * s, 12 * s, P.potBrown);
  rect(ctx, x + 6 * s, y + 16 * s, 8 * s, 2, P.potDark);
  rect(ctx, x + 2 * s, y + 26 * s, 16 * s, 4 * s, P.potDark);
  rect(ctx, x + 2 * s, y + 16 * s, 16 * s, 2 * s, '#8a6a40');
  rect(ctx, x + 6 * s, y + 16 * s + 2, 8 * s, 2 * s, P.deskDark);
  rect(ctx, x + 4 * s, y + 4 * s, 12 * s, 12 * s, P.plantGreen);
  rect(ctx, x + 2 * s, y + 6 * s, 16 * s, 8 * s, P.plantGreen);
  rect(ctx, x + 6 * s, y + 2 * s, 8 * s, 4 * s, P.plantLight);
  rect(ctx, x + 10 * s, y + 6 * s, 4 * s, 4 * s, P.plantLight);
  rect(ctx, x, y + 8 * s, 4 * s, 6 * s, P.plantDark);
  rect(ctx, x + 16 * s, y + 8 * s, 4 * s, 6 * s, P.plantDark);
  rect(ctx, x + 8 * s, y + 12 * s, 4 * s, 4 * s, P.plantDark);
  rect(ctx, x + 8 * s, y, 4 * s, 4 * s, P.plantLight);
  rect(ctx, x + 4 * s, y + 2 * s, 2 * s, 4 * s, P.plantGreen);
  rect(ctx, x + 14 * s, y + 4 * s, 2 * s, 4 * s, P.plantGreen);
}

// ─── Window ───
export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w?: number, h?: number): void {
  const ww = w || 44; const hh = h || 36;
  rect(ctx, x - 2, y - 2, ww + 4, hh + 4, P.windowFrame);
  rect(ctx, x, y, ww, hh, P.windowFrame);
  rect(ctx, x + 4, y + 4, ww - 8, hh - 8, P.skyBlue);
  rect(ctx, x + 4, y + 4, ww - 8, 6, '#9cc8e8');
  rect(ctx, x + ww / 2 - 2, y, 4, hh, P.windowFrame);
  rect(ctx, x, y + hh / 2 - 2, ww, 4, P.windowFrame);
  rect(ctx, x + 6, y + hh / 2 + 4, 12, hh / 2 - 8, P.treesGreen);
  rect(ctx, x + ww / 2 + 4, y + hh / 2 + 4, 10, hh / 2 - 8, '#509040');
  rect(ctx, x + 20, y + hh / 2 + 2, 8, hh / 2 - 6, '#60a050');
  rect(ctx, x + 8, y + 6, 8, 4, P.textWhite);
  rect(ctx, x + 6, y + 8, 12, 2, P.textWhite);
  rect(ctx, x, y, 4, hh, '#7a5a3a');
  rect(ctx, x + ww - 4, y, 4, hh, '#7a5a3a');
  rect(ctx, x - 2, y + hh, ww + 4, 4, P.windowFrame);
}

// ─── Whiteboard ───
export function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x - 2, y - 2, w + 4, h + 4, P.wbFrame);
  rect(ctx, x, y, w, h, P.whiteboard);
  for (let i = 0; i < 4; i++) {
    const lw = w - 28 - (i % 2) * 16;
    rect(ctx, x + 8, y + 8 + i * 8, lw, 2, P.cabinetGray);
  }
  rect(ctx, x + 6, y + 8, 2, 2, P.shirtRed);
  rect(ctx, x + 6, y + 16, 2, 2, P.shirtBlue);
  rect(ctx, x + 6, y + 24, 2, 2, P.shirtGreen);
  rect(ctx, x + 4, y + h - 4, w - 8, 4, P.cabinetDark);
  rect(ctx, x + 8, y + h - 6, 8, 2, P.shirtRed);
  rect(ctx, x + 20, y + h - 6, 8, 2, P.shirtBlue);
}

// ─── Presentation Screen ───
export function drawPresScreen(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x - 2, y - 2, w + 4, h + 4, P.wbFrame);
  rect(ctx, x, y, w, h, '#e8e8e8');
  rect(ctx, x, y, w, 6, P.wbFrame);
  const colors = [P.shirtBlue, P.shirtGreen, P.shirtRed, P.bookYellow, '#6a4488'];
  const startX = x + 8;
  for (let i = 0; i < 5; i++) {
    const bh = 8 + ((i + 1) * 6) % 28;
    rect(ctx, startX + i * 10, y + h - 8 - bh, 8, bh, colors[i]!);
  }
  const cx = x + w - 24, cy = y + 20;
  rect(ctx, cx, cy, 8, 8, P.shirtBlue);
  rect(ctx, cx + 8, cy, 8, 8, P.shirtGreen);
  rect(ctx, cx, cy + 8, 8, 8, P.shirtRed);
  rect(ctx, cx + 8, cy + 8, 8, 8, P.bookYellow);
  for (let i = 0; i < 8; i++) {
    rect(ctx, startX + i * 6, y + h - 12 - ((i * 4) % 16), 4, 2, P.plantDark);
  }
}

// ─── Couch ───
export function drawCouch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.globalAlpha = 0.3;
  rect(ctx, x + 2, y + 28, 56, 4, P.border);
  ctx.globalAlpha = 1;
  rect(ctx, x, y - 10, 56, 12, P.couchDark);
  rect(ctx, x + 4, y - 8, 48, 8, P.couchRed);
  rect(ctx, x, y, 56, 24, P.couchRed);
  rect(ctx, x, y + 24, 56, 4, P.couchDark);
  rect(ctx, x - 4, y - 6, 6, 32, P.couchDark);
  rect(ctx, x + 54, y - 6, 6, 32, P.couchDark);
  rect(ctx, x + 26, y + 2, 4, 20, P.couchDark);
  rect(ctx, x + 6, y + 4, 16, 4, '#a05040');
  rect(ctx, x + 34, y + 4, 16, 4, '#a05040');
  rect(ctx, x + 6, y + 2, 10, 8, P.bookYellow);
  rect(ctx, x + 40, y + 2, 10, 8, P.shirtBlue);
}

// ─── Table ───
export function drawTable(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x + 4, y + h + 2, 4, 6, P.tableDark);
  rect(ctx, x + w - 8, y + h + 2, 4, 6, P.tableDark);
  rect(ctx, x, y, w, h, P.tableWood);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, P.deskLight);
  rect(ctx, x + 6, y + 4, w - 12, 2, P.tableWood);
  rect(ctx, x + 10, y + h - 6, w - 20, 2, P.tableWood);
  rect(ctx, x, y + h, w, 4, P.tableDark);
}

// ─── Boardroom Table ───
export function drawBoardTable(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const rad = 20;
  const marble = '#D0CCC8';
  const marbleLight = '#E8E4E0';
  const marbleDark = '#A8A4A0';
  const vein = '#7A7670';

  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + h + 2, w, 10, rad);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.roundRect(x, y + 6, w, h + 4, rad);
  ctx.fillStyle = marbleDark;
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.fillStyle = marble;
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, w - 8, h - 8, rad - 4);
  ctx.fillStyle = marbleLight;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.clip();
  ctx.strokeStyle = vein;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  for (let v = 0; v < 4; v++) {
    const vx = x + 30 + v * Math.floor((w - 60) / 4);
    const vy = y + 6 + (v % 3) * 10;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + 40 + (v % 2) * 20, vy + 28 + (v % 2) * 12);
    ctx.stroke();
  }
  ctx.strokeStyle = marbleDark;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let v = 0; v < 3; v++) {
    const vx = x + 50 + v * Math.floor((w - 100) / 3);
    const vy = y + h - 20 - (v % 2) * 14;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + 28, vy - 16);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.strokeStyle = marbleDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  rect(ctx, x + 24, y + 16, 16, 12, P.textWhite);
  rect(ctx, x + 26, y + 18, 12, 2, P.cabinetGray);
  rect(ctx, x + w - 44, y + 20, 16, 12, P.textWhite);
  rect(ctx, x + w / 2 - 10, y + 10, 20, 14, P.textWhite);
  rect(ctx, x + w / 2 - 8, y + 12, 16, 2, P.cabinetGray);
  rect(ctx, x + w / 2 - 8, y + 16, 12, 2, P.cabinetGray);
  rect(ctx, x + 48, y + 12, 6, 6, P.textWhite);
  rect(ctx, x + 48, y + 10, 6, 2, P.cabinetGray);
  rect(ctx, x + w - 28, y + 16, 6, 6, P.textWhite);
}

// ─── Character (uses AI sprite if available, else rect fallback) ───
export function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, config: AgentAppearance, frame: number, agentKey?: string): void {
  if (agentKey && getSheet(agentKey)) {
    const animFrame = frame ? Math.floor(frame / 15) : 0;
    const drawn = drawSpriteFrame(ctx, agentKey, 'idle_front', animFrame, x - 8, y - 40, 32, 64);
    if (drawn) return;
  }
  const hairC = (P as Record<string, string>)[config.hair] || P.hairBrown;
  const shirtC = (P as Record<string, string>)[config.shirt] || P.shirtBlue;
  rect(ctx, x + 2, y + 10, 12, 2, P.skinDark);
  rect(ctx, x + 2, y + 2, 12, 10, P.skin);
  rect(ctx, x + 4, y, 8, 2, P.skin);
  rect(ctx, x + 2, y + 8, 2, 4, P.skinDark);
  rect(ctx, x + 12, y + 8, 2, 4, P.skinDark);
  rect(ctx, x + 2, y, 12, 4, hairC);
  rect(ctx, x + 4, y - 2, 8, 2, hairC);
  rect(ctx, x, y + 2, 2, 6, hairC);
  rect(ctx, x + 14, y + 2, 2, 6, hairC);
  rect(ctx, x + 4, y + 6, 2, 2, P.hairBlack);
  rect(ctx, x + 10, y + 6, 2, 2, P.hairBlack);
  rect(ctx, x + 4, y + 6, 1, 1, P.textWhite);
  rect(ctx, x + 10, y + 6, 1, 1, P.textWhite);
  rect(ctx, x + 6, y + 8, 4, 2, P.skinDark);
  rect(ctx, x, y + 12, 16, 12, shirtC);
  rect(ctx, x + 4, y + 12, 8, 2, P.textWhite);
  rect(ctx, x, y + 12, 2, 12, P.border);
  ctx.globalAlpha = 0.2;
  rect(ctx, x, y + 12, 2, 12, P.border);
  ctx.globalAlpha = 1;
  rect(ctx, x + 14, y + 12, 2, 12, P.border);
  ctx.globalAlpha = 0.15;
  rect(ctx, x + 14, y + 12, 2, 12, P.border);
  ctx.globalAlpha = 1;
  rect(ctx, x - 2, y + 12, 2, 10, shirtC);
  rect(ctx, x + 16, y + 12, 2, 10, shirtC);
  rect(ctx, x - 2, y + 20, 2, 4, P.skin);
  rect(ctx, x + 16, y + 20, 2, 4, P.skin);
  if (frame && frame % 80 < 40) rect(ctx, x + 4, y - 4, 8, 2, hairC);
}

// ─── Character sitting at desk ───
export function drawSeatedChar(ctx: CanvasRenderingContext2D, x: number, y: number, config: AgentAppearance, frame: number, agentKey?: string): void {
  if (agentKey && getSheet(agentKey)) {
    const animFrame = frame ? Math.floor(frame / 20) : 0;
    const drawn = drawSpriteFrame(ctx, agentKey, 'sit_front', animFrame, x - 8, y - 30, 32, 64);
    if (drawn) return;
  }
  drawCharacter(ctx, x, y, config, frame);
  rect(ctx, x + 2, y + 24, 6, 6, P.pants);
  rect(ctx, x + 8, y + 24, 6, 6, P.pants);
  rect(ctx, x, y + 28, 6, 2, P.hairBlack);
  rect(ctx, x + 10, y + 28, 6, 2, P.hairBlack);
}

// ─── Boardroom character ───
export function drawBoardChar(ctx: CanvasRenderingContext2D, x: number, y: number, config: AgentAppearance, facing: string, frame: number): void {
  const hairC = (P as Record<string, string>)[config.hair] || P.hairBrown;
  const shirtC = (P as Record<string, string>)[config.shirt] || P.shirtBlue;
  rect(ctx, x, y + 8, 12, 10, shirtC);
  rect(ctx, x + 4, y + 8, 4, 2, P.textWhite);
  rect(ctx, x + 2, y, 8, 8, P.skin);
  rect(ctx, x + 2, y, 8, 4, hairC);
  rect(ctx, x, y + 2, 2, 2, hairC);
  rect(ctx, x + 10, y + 2, 2, 2, hairC);
  if (facing !== 'up') {
    rect(ctx, x + 2, y + 4, 2, 2, P.hairBlack);
    rect(ctx, x + 8, y + 4, 2, 2, P.hairBlack);
  }
  rect(ctx, x - 2, y + 10, 2, 6, shirtC);
  rect(ctx, x + 12, y + 10, 2, 6, shirtC);
  rect(ctx, x - 2, y + 14, 2, 2, P.skin);
  rect(ctx, x + 12, y + 14, 2, 2, P.skin);
  if (frame && frame % 90 < 45) rect(ctx, x + 4, y - 2, 4, 2, hairC);
}

// ─── Wall Sconce / Light ───
export function drawSconce(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  rect(ctx, x + 2, y, 6, 10, P.deskWood);
  rect(ctx, x, y - 4, 10, 6, P.bookYellow);
  rect(ctx, x + 2, y - 6, 6, 4, '#e0c060');
  const pulse = frame ? Math.sin(frame * 0.03) * 0.1 + 0.15 : 0.15;
  ctx.globalAlpha = pulse;
  rect(ctx, x - 4, y - 10, 18, 20, '#ffe880');
  ctx.globalAlpha = 1;
}

// ─── Wall Art ───
export function drawWallArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x - 2, y - 2, w + 4, h + 4, P.deskDark);
  rect(ctx, x, y, w, h, P.deskWood);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, P.skyBlue);
  rect(ctx, x + 4, y + h - 10, w - 8, 6, P.treesGreen);
  rect(ctx, x + 6, y + h - 14, 6, 6, '#509040');
  rect(ctx, x + w - 10, y + 4, 4, 4, P.bookYellow);
}

// ─── Tile Floor ───
export function drawTileFloor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, P.floorTile);
  for (let ty = 0; ty < h; ty += 40) {
    for (let tx = 0; tx < w; tx += 40) {
      const seed = (tx * 7 + ty * 13) % 5;
      if (seed === 0) rect(ctx, x + tx + 4, y + ty + 4, 32, 32, P.floorTileLight);
      if (seed === 2) rect(ctx, x + tx + 8, y + ty + 8, 24, 24, P.floorTileDark);
    }
  }
}

// ─── Status Dot ───
export function drawStatusDot(ctx: CanvasRenderingContext2D, x: number, y: number, status: string, frame: number): void {
  const colors: Record<string, string> = { working: '#4caf50', idle: '#ff9800', meeting: '#2196f3' };
  const c: string = colors[status] ?? '#4caf50';
  const pulse = Math.sin((frame || 0) * 0.06) * 0.3 + 0.7;
  ctx.globalAlpha = pulse * 0.3;
  rect(ctx, x - 4, y - 4, 16, 16, c);
  ctx.globalAlpha = pulse;
  rect(ctx, x - 2, y - 2, 12, 12, c);
  ctx.globalAlpha = 1;
  rect(ctx, x, y, 8, 8, c);
  rect(ctx, x, y, 4, 4, P.textWhite);
  ctx.globalAlpha = 0.4;
  rect(ctx, x, y, 4, 4, P.textWhite);
  ctx.globalAlpha = 1;
}

// ─── Water Cooler ───
export function drawWaterCooler(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x + 2, y + 28, 12, 8, P.cabinetGray);
  rect(ctx, x, y + 8, 16, 20, P.floorTileLight);
  rect(ctx, x + 2, y + 10, 12, 16, '#b0c8e0');
  rect(ctx, x + 2, y, 12, 10, '#90b8d8');
  rect(ctx, x + 4, y - 2, 8, 4, '#a0c8e0');
  rect(ctx, x + 6, y + 20, 4, 4, P.cabinetDark);
  rect(ctx, x - 2, y + 16, 4, 8, P.textWhite);
}

// ─── Coffee Mug ───
export function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number, color?: string): void {
  const c = color || P.textWhite;
  rect(ctx, x, y, 8, 8, c);
  rect(ctx, x, y, 8, 2, P.cabinetGray);
  rect(ctx, x + 8, y + 2, 2, 4, c);
}

// ─── Wall Clock ───
export function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  rect(ctx, x, y, 16, 16, P.deskWood);
  rect(ctx, x + 2, y + 2, 12, 12, P.textWhite);
  rect(ctx, x + 6, y + 6, 4, 4, P.hairBlack);
  rect(ctx, x + 8, y + 2, 2, 6, P.hairBlack);
  const angle = ((frame || 0) % 360);
  if (angle < 90) rect(ctx, x + 8, y + 8, 4, 2, P.cabinetGray);
  else if (angle < 180) rect(ctx, x + 8, y + 8, 2, 4, P.cabinetGray);
  else if (angle < 270) rect(ctx, x + 4, y + 8, 4, 2, P.cabinetGray);
  else rect(ctx, x + 8, y + 4, 2, 4, P.cabinetGray);
}

// ─── Trash Can ───
export function drawTrashCan(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x, y, 12, 16, P.cabinetGray);
  rect(ctx, x + 2, y + 2, 8, 12, P.cabinetDark);
  rect(ctx, x - 2, y, 16, 4, P.cabinetGray);
}

// ─── Label ───
export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size?: number, color?: string, shadow?: boolean): void {
  ctx.font = `${size || 6}px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  if (shadow !== false) {
    ctx.fillStyle = P.textShadow;
    ctx.fillText(text, x + 2, y + 2);
  }
  ctx.fillStyle = color || P.textCream;
  ctx.fillText(text, x, y);
}

// ─── Label with background ───
export function drawLabelBg(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size?: number, color?: string): void {
  ctx.font = `${size || 6}px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width;
  rect(ctx, x - tw / 2 - 8, y - (size || 6) - 6, tw + 16, (size || 6) + 14, P.labelBg);
  rect(ctx, x - tw / 2 - 6, y - (size || 6) - 4, tw + 12, (size || 6) + 10, '#1a1932');
  ctx.fillStyle = color || P.textCream;
  ctx.fillText(text, x, y);
}

/**
 * Draws a small dark-brown document table in pixelScene coordinates.
 * Documents appear stacked on top of it when files are uploaded to the agent.
 */
export function drawFileTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number = 48,
  h: number = 26,
): void {
  const sx = x | 0;
  const sy = y | 0;
  const sw = w | 0;
  const sh = h | 0;
  const legH = 10;

  // Drop shadow beneath legs
  ctx.globalAlpha = 0.2;
  rect(ctx, sx + 4, sy + sh + legH + 2, sw - 6, 4, '#000000');
  ctx.globalAlpha = 1;

  // Legs
  rect(ctx, sx + 4,      sy + sh, 4, legH, '#2C1A0E');
  rect(ctx, sx + sw - 8, sy + sh, 4, legH, '#2C1A0E');

  // Table underside edge (3-D depth)
  rect(ctx, sx, sy + sh - 2, sw, 4, '#2C1A0E');

  // Table surface (rich brown)
  rect(ctx, sx, sy, sw, sh - 2, '#5C3317');

  // Top highlight
  rect(ctx, sx + 1, sy + 1, sw - 2, 2, '#7A4A28');

  // Wood grain lines
  for (let gx = sx + 8; gx < sx + sw - 4; gx += 10) {
    ctx.globalAlpha = 0.15;
    rect(ctx, gx, sy + 2, 1, sh - 6, '#1A0D00');
  }
  ctx.globalAlpha = 1;

  // Border
  ctx.strokeStyle = '#1A0D00';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 3);
}
// ─── Small File-Drop Table ───
/** A compact side table shown in each office as a visual file-drop target. */
export function drawSmallFileTable(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Legs
  rect(ctx, x + 2,  y + 20, 3, 6, P.tableDark);
  rect(ctx, x + 19, y + 20, 3, 6, P.tableDark);
  // Surface
  rect(ctx, x,      y,      24, 20, P.tableWood);
  rect(ctx, x + 2,  y + 2,  20, 16, P.deskLight);
  rect(ctx, x + 4,  y + 4,  16,  2, P.tableWood);
  rect(ctx, x,      y + 20, 24,  3, P.tableDark);
  // Small paper icon on surface (matches renderFileIcons look)
  rect(ctx, x + 8,  y + 5,   8, 10, '#ffffff');
  rect(ctx, x + 8,  y + 5,   8,  2, '#ef4444'); // PDF red header bar
  rect(ctx, x + 10, y + 8,   4,  1, '#cccccc');
  rect(ctx, x + 10, y + 10,  4,  1, '#cccccc');
  rect(ctx, x + 14, y + 5,   2,  2, '#e0e0e0'); // folded corner
}

// ─── Room Header Banner ───
/**
 * Draws a premium pixel-art room header above the room top wall.
 * Replaces the plain drawLabelBg + drawLabel combo with a styled banner:
 *   - Dark rounded pill background with subtle accent tint
 *   - Bold pixel-font agent name in accent color
/**
 * Truncate `text` with an ellipsis so it fits within `maxPx` pixels.
 * Returns the (possibly truncated) string.
 */
function clipText(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string {
  if (ctx.measureText(text).width <= maxPx) return text;
  const ellipsis = '...';
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxPx) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + ellipsis;
}

/**
 * Draws a pixel-art name + role pill header above a room:
 *   - Bold accent-coloured name on top
 *   - Smaller role label underneath in cream
 *   - Decorative bracket-dash rule lines either side of the name
 *
 * @param maxWidth  Optional max pixel width for the pill.
 *                  Pass the room width to prevent text bleeding outside the box.
 */
export function drawRoomHeader(
  ctx: CanvasRenderingContext2D,
  name: string,
  role: string,
  cx: number,
  y: number,
  accentHex: string = '#fbbf24',
  maxWidth?: number,
): void {
  const nameSize = 10;
  const roleSize = 7;
  const padX = 14; // horizontal padding inside pill
  const padY = 5;

  // Fixed pill width anchored to room width — never dynamic from text
  const pillW = Math.min(maxWidth ?? 180, 220);
  const pillH = nameSize + roleSize + padY * 3 + 4;
  const px = (cx - pillW / 2) | 0;
  const py = Math.max(2, (y - pillH - 6) | 0);

  // Max text area inside the pill
  const maxTextW = pillW - padX * 2;

  // Measure and clip name
  ctx.font = `${nameSize}px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  const displayName = clipText(ctx, name, maxTextW);

  // Measure and clip role
  ctx.font = `${roleSize}px 'Press Start 2P', monospace`;
  const displayRole = clipText(ctx, role, maxTextW);

  // Drop shadow
  ctx.globalAlpha = 0.22;
  rect(ctx, px + 3, py + 4, pillW, pillH, '#000000');
  ctx.globalAlpha = 1;

  // Pill background
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 5);
    ctx.fillStyle = '#0f1120';
    ctx.fill();
  } else {
    rect(ctx, px, py, pillW, pillH, '#0f1120');
  }

  // Accent top strip
  rect(ctx, px + 4, py, pillW - 8, 2, accentHex);

  // Accent side glows
  ctx.globalAlpha = 0.3;
  rect(ctx, px, py + 2, 3, pillH - 4, accentHex);
  rect(ctx, px + pillW - 3, py + 2, 3, pillH - 4, accentHex);
  ctx.globalAlpha = 1;

  // Name row Y
  const nameY = py + padY + nameSize;

  // Name shadow
  ctx.font = `${nameSize}px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(displayName, cx + 1, nameY + 1);
  // Name
  ctx.fillStyle = accentHex;
  ctx.fillText(displayName, cx, nameY);

  // Separator line
  rect(ctx, px + 8, nameY + 3, pillW - 16, 1, '#1e2240');

  // Role
  ctx.font = `${roleSize}px 'Press Start 2P', monospace`;
  ctx.fillStyle = '#c8c4b0';
  ctx.fillText(displayRole, cx, nameY + roleSize + padY + 1);
}

