/**
 * Pixel-art scene composition — draws all offices, boardroom, and hallways.
 * Ported from TEST PIXEL TEAM's scene.js
 */
import { P } from './palette';
import * as S from './pixelSprites';

import type { RoomRect, AgentAppearance } from './pixelSprites';
// ═══════════════════════════════════════════
// Layout constants — room grid (1280×912 native)
// ═══════════════════════════════════════════
export const GAME_W = 1280;
export const GAME_H = 912;
const GAP = 8;

const LW = 300, HW = 52, CW = 528, RW = 300;
const TH = 220, HH = 52, MH = 288, BH = 220;
const C1 = GAP, HL = C1 + LW + GAP, C2 = HL + HW + GAP, HR = C2 + CW + GAP, C3 = HR + HW + GAP;
const TITLE_H = 32;
const R1 = GAP + TITLE_H, HT = R1 + TH + GAP, R2 = HT + HH + GAP, HB = R2 + MH + GAP, R3 = HB + HH + GAP;

export const ROOMS: Record<string, RoomRect> = {
  isaac:    { x: C1, y: R1, w: LW, h: TH, type: 'office',    door: { side: 'bottom', pos: 0.5 } },
  billy:    { x: C2, y: R1, w: CW, h: TH, type: 'office',    door: { side: 'bottom', pos: 0.5 } },
  patrik:   { x: C3, y: R1, w: RW, h: TH, type: 'office',    door: { side: 'bottom', pos: 0.5 } },
  hallT:    { x: HL, y: HT, w: CW + HW * 2 + GAP * 2, h: HH, type: 'hallway' },
  hallL:    { x: HL, y: HT, w: HW, h: MH + HH * 2 + GAP * 2, type: 'hallway' },
  hallR:    { x: HR, y: HT, w: HW, h: MH + HH * 2 + GAP * 2, type: 'hallway' },
  hallB:    { x: HL, y: HB, w: CW + HW * 2 + GAP * 2, h: HH, type: 'hallway' },
  marcos:   { x: C1, y: R2, w: LW, h: MH, type: 'office',    door: { side: 'right',  pos: 0.4 } },
  board:    { x: C2, y: R2, w: CW, h: MH, type: 'boardroom', door: { side: 'left',   pos: 0.4 } },
  sandra:   { x: C3, y: R2, w: RW, h: MH, type: 'office',    door: { side: 'left',   pos: 0.4 } },
  charlie:  { x: C1, y: R3, w: LW, h: BH, type: 'office',    door: { side: 'right',  pos: 0.6 } },
  breakRm:  { x: C2, y: R3, w: 240, h: BH, type: 'breakroom', door: { side: 'top',   pos: 0.3 } },
  wc1:      { x: C2 + 240 + GAP, y: R3, w: 132, h: BH, type: 'wc', door: { side: 'left', pos: 0.5 } },
  wc2:      { x: C2 + 240 + GAP + 132 + GAP, y: R3, w: 128, h: BH, type: 'wc', door: { side: 'right', pos: 0.5 } },
  wendy:    { x: C3, y: R3, w: RW, h: BH, type: 'office',    door: { side: 'left',   pos: 0.7 } },
};

export const AGENTS: Record<string, AgentAppearance> = {
  billy:   { name: 'BILLY',   role: 'CEO',               hair: 'hairGray',   shirt: 'shirtWhite', status: 'working' },
  isaac:   { name: 'ISAAC',   role: 'DEVELOPMENT',       hair: 'hairBrown',  shirt: 'shirtBlue',  status: 'working' },
  patrik:  { name: 'PATRIK',  role: 'CFO',               hair: 'hairBlack',  shirt: 'shirtGreen', status: 'working' },
  marcos:  { name: 'MARCOS',  role: 'LAWYER',            hair: 'hairBlack',  shirt: 'shirtBlue',  status: 'idle' },
  sandra:  { name: 'SANDRA',  role: 'LINE PRODUCER',     hair: 'hairRed',    shirt: 'shirtGreen', status: 'working' },
  charlie: { name: 'CHARLIE', role: 'DESIGNER',          hair: 'hairBlonde', shirt: 'shirtOrange', status: 'idle' },
  wendy:   { name: 'WENDY',   role: 'PERFORMANCE COACH', hair: 'hairBrown',  shirt: 'shirtPurple', status: 'meeting' },
};

// ═══════════════════════════════════════════
// Draw individual office
// ═══════════════════════════════════════════
function drawOffice(ctx: CanvasRenderingContext2D, key: string, frame: number): void {
  const r = ROOMS[key];
  const a = AGENTS[key];
  if (!r || !a) return;

  S.drawRoomBase(ctx, r, P.wallTeal, P.floorWood);
  const wallH = Math.round(r.h * 0.32);
  const floorY = r.y + wallH;

  // ─── Isaac (Development — dual monitors, messy desk) ───
  if (key === 'isaac') {
    S.drawWindow(ctx, r.x + 20, r.y + 12, 48, 40);
    S.drawWallArt(ctx, r.x + 84, r.y + 16, 28, 20);
    S.drawClock(ctx, r.x + 124, r.y + 16, frame);
    S.drawBookshelf(ctx, r.x + 160, r.y + 8);
    S.drawDesk(ctx, r.x + 20, floorY + 36, 88, 28, 'right');
    S.drawMonitor(ctx, r.x + 32, floorY + 8);
    S.drawMonitor(ctx, r.x + 64, floorY + 8, P.screenGreen);
    S.drawMug(ctx, r.x + 96, floorY + 40, P.shirtBlue);
    S.drawChair(ctx, r.x + 48, floorY + 72);
    // Real game characters (Layer 4) handle agent rendering
    // S.drawSeatedChar(ctx, r.x + 44, floorY + 48, a, frame, key);
    S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 8);
    S.drawPlant(ctx, r.x + r.w - 32, floorY + 76, 1);
    S.drawTrashCan(ctx, r.x + r.w - 20, floorY + 120);
  }

  // ─── Billy (CEO — executive desk, big windows, plant pair) ───
  if (key === 'billy') {
    S.drawWindow(ctx, r.x + 48, r.y + 12, 52, 40);
    S.drawWindow(ctx, r.x + r.w - 108, r.y + 12, 52, 40);
    S.drawWallArt(ctx, r.x + r.w / 2 - 16, r.y + 12, 32, 24);
    S.drawClock(ctx, r.x + r.w / 2 + 28, r.y + 16, frame);
    S.drawBookshelf(ctx, r.x + 12, r.y + 8);
    S.drawDesk(ctx, r.x + r.w / 2 - 64, floorY + 32, 128, 32, 'right');
    S.drawMonitor(ctx, r.x + r.w / 2 - 16, floorY + 4);
    S.drawMug(ctx, r.x + r.w / 2 + 24, floorY + 40, P.textWhite);
    S.drawChair(ctx, r.x + r.w / 2 - 8, floorY + 72);
    // S.drawSeatedChar(ctx, r.x + r.w / 2 - 12, floorY + 48, a, frame, key);
    S.drawPlant(ctx, r.x + 12, floorY + 12, 2);
    S.drawPlant(ctx, r.x + r.w - 40, floorY + 12, 2);
    S.drawFilingCabinet(ctx, r.x + r.w - 44, floorY + 68);
    S.drawTrashCan(ctx, r.x + r.w / 2 + 60, floorY + 100);
  }

  // ─── Patrik (CFO — bookshelves, organized) ───
  if (key === 'patrik') {
    S.drawWindow(ctx, r.x + r.w - 72, r.y + 12, 48, 40);
    S.drawBookshelf(ctx, r.x + 12, r.y + 8);
    S.drawBookshelf(ctx, r.x + 64, r.y + 8);
    S.drawClock(ctx, r.x + 120, r.y + 16, frame);
    S.drawDesk(ctx, r.x + r.w - 124, floorY + 36, 88, 28, 'left');
    S.drawMonitor(ctx, r.x + r.w - 104, floorY + 8);
    S.drawMug(ctx, r.x + r.w - 120, floorY + 40, P.shirtGreen);
    S.drawChair(ctx, r.x + r.w - 88, floorY + 72);
    // S.drawSeatedChar(ctx, r.x + r.w - 92, floorY + 48, a, frame, key);
    S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 80);
    S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 8);
    S.drawPlant(ctx, r.x + 16, floorY + 100, 1);
  }

  // ─── Marcos (Lawyer — lots of books, framed certificates) ───
  if (key === 'marcos') {
    S.drawWindow(ctx, r.x + 20, r.y + 12, 48, 40);
    S.drawWallArt(ctx, r.x + 84, r.y + 16, 24, 20);
    S.drawWallArt(ctx, r.x + 116, r.y + 16, 24, 20);
    S.drawBookshelf(ctx, r.x + 160, r.y + 8);
    S.drawBookshelf(ctx, r.x + 212, r.y + 8);
    S.drawClock(ctx, r.x + r.w - 28, r.y + 20, frame);
    S.drawDesk(ctx, r.x + 20, floorY + 48, 80, 28, 'right');
    S.drawMonitor(ctx, r.x + 36, floorY + 20);
    S.drawMug(ctx, r.x + 72, floorY + 52, P.shirtRed);
    S.drawChair(ctx, r.x + 44, floorY + 84);
    // S.drawSeatedChar(ctx, r.x + 40, floorY + 60, a, frame, key);
    S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 20);
    S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 76);
    S.drawPlant(ctx, r.x + 8, floorY + 160, 1);
    S.drawTrashCan(ctx, r.x + 124, floorY + 160);
  }

  // ─── Sandra (Line Producer — organized, whiteboards) ───
  if (key === 'sandra') {
    S.drawWindow(ctx, r.x + r.w - 72, r.y + 12, 48, 40);
    S.drawWhiteboard(ctx, r.x + 16, r.y + 12, 56, 40);
    S.drawBookshelf(ctx, r.x + 88, r.y + 8);
    S.drawClock(ctx, r.x + r.w - 28, r.y + 20, frame);
    S.drawDesk(ctx, r.x + r.w - 116, floorY + 48, 80, 28, 'left');
    S.drawMonitor(ctx, r.x + r.w - 96, floorY + 20);
    S.drawMug(ctx, r.x + r.w - 56, floorY + 52, P.bookYellow);
    S.drawChair(ctx, r.x + r.w - 84, floorY + 84);
    // S.drawSeatedChar(ctx, r.x + r.w - 88, floorY + 60, a, frame, key);
    S.drawFilingCabinet(ctx, r.x + 12, floorY + 20);
    S.drawFilingCabinet(ctx, r.x + 12, floorY + 76);
    S.drawPlant(ctx, r.x + r.w - 32, floorY + 160, 1);
    S.drawTrashCan(ctx, r.x + 52, floorY + 160);
  }

  // ─── Charlie (Designer — art on walls, drawing table, colorful) ───
  if (key === 'charlie') {
    S.drawWindow(ctx, r.x + 20, r.y + 12, 48, 40);
    S.drawWallArt(ctx, r.x + 88, r.y + 16, 36, 28);
    S.drawWallArt(ctx, r.x + 136, r.y + 20, 24, 20);
    S.drawWallArt(ctx, r.x + 172, r.y + 16, 20, 24);
    S.drawTable(ctx, r.x + 120, floorY + 28, 92, 44);
    S.drawDesk(ctx, r.x + 20, floorY + 32, 72, 24, 'right');
    S.drawMonitor(ctx, r.x + 32, floorY + 8, '#c090d0');
    S.drawMug(ctx, r.x + 72, floorY + 36, P.shirtOrange);
    S.drawChair(ctx, r.x + 44, floorY + 64);
    // S.drawSeatedChar(ctx, r.x + 40, floorY + 40, a, frame, key);
    S.drawPlant(ctx, r.x + r.w - 32, floorY + 12, 1);
    S.drawTrashCan(ctx, r.x + r.w - 20, floorY + 104);
  }

  // ─── Wendy (Performance Coach — couch, zen plant, whiteboard) ───
  if (key === 'wendy') {
    S.drawWindow(ctx, r.x + r.w - 72, r.y + 12, 48, 40);
    S.drawWhiteboard(ctx, r.x + 16, r.y + 12, 48, 36);
    S.drawWallArt(ctx, r.x + 76, r.y + 20, 28, 20);
    S.drawClock(ctx, r.x + r.w - 28, r.y + 20, frame);
    S.drawDesk(ctx, r.x + r.w - 116, floorY + 32, 80, 28, 'left');
    S.drawMonitor(ctx, r.x + r.w - 92, floorY + 4);
    S.drawMug(ctx, r.x + r.w - 112, floorY + 36, P.shirtPurple);
    S.drawChair(ctx, r.x + r.w - 80, floorY + 68);
    // S.drawSeatedChar(ctx, r.x + r.w - 84, floorY + 44, a, frame, key);
    S.drawFilingCabinet(ctx, r.x + 12, floorY + 12);
    S.drawCouch(ctx, r.x + 76, floorY + 96);
    S.drawTrashCan(ctx, r.x + r.w - 20, floorY + 104);
    S.drawPlant(ctx, r.x + r.w - 32, floorY + 100, 2);
  }

  // Agent name label
  S.drawLabelBg(ctx, a.name, r.x + r.w / 2, r.y - 20, 10, P.textWhite);
  S.drawLabel(ctx, a.role, r.x + r.w / 2, r.y - 4, 8, P.textCream);

  // Status indicator
  S.drawStatusDot(ctx, r.x + r.w - 20, r.y + 12, a.status, frame);

  // Room walls with door
  S.drawRoomWalls(ctx, r);
}

// ═══════════════════════════════════════════
// Boardroom
// ═══════════════════════════════════════════
function drawBoardroom(ctx: CanvasRenderingContext2D, frame: number): void {
  const r = ROOMS.board;
  const wallH = Math.round(r.h * 0.25);

  S.rect(ctx, r.x, r.y, r.w, 6, P.border);
  S.rect(ctx, r.x, r.y + 6, r.w, wallH - 6, P.wallTeal);
  S.rect(ctx, r.x, r.y + 6, r.w, 2, P.wallTealLight);
  for (let wx = r.x + 16; wx < r.x + r.w; wx += 28) {
    S.rect(ctx, wx, r.y + 10, 2, wallH - 16, P.wallTealDark);
  }
  S.rect(ctx, r.x, r.y + wallH - 6, r.w, 6, P.deskDark);
  S.rect(ctx, r.x, r.y + wallH - 8, r.w, 2, P.deskWood);

  const fy = r.y + wallH;
  const fh = r.h - wallH;
  S.rect(ctx, r.x, fy, r.w, fh, '#2A2828');
  for (let px = r.x + 20; px < r.x + r.w; px += 20) {
    S.rect(ctx, px, fy, 2, fh, '#1E1C1C');
    const offset = ((px - r.x) % 40 === 0) ? 40 : 100;
    S.rect(ctx, px - 10, fy + offset, 10, 2, '#1E1C1C');
    S.rect(ctx, px - 10, fy + offset + 120, 10, 2, '#1E1C1C');
  }
  S.rect(ctx, r.x, fy, r.w, 4, '#1E1C1C');

  S.drawPresScreen(ctx, r.x + 72, r.y + 8, 88, 56);
  S.drawWhiteboard(ctx, r.x + r.w - 160, r.y + 12, 76, 48);
  S.drawSconce(ctx, r.x + 36, r.y + 16, frame);
  S.drawSconce(ctx, r.x + r.w - 44, r.y + 16, frame);

  const fullW = r.w - 200, fullH = r.h - wallH - 100;
  const tw = Math.round(fullW * 0.8), th = Math.round(fullH * 0.8);
  const tx = r.x + 100 + Math.round((fullW - tw) / 2);
  const ty = r.y + wallH + 40 + Math.round((fullH - th) / 2);
  S.drawBoardTable(ctx, tx, ty, tw, th);

  // Executive chairs
  const cBrown = '#5C3A1E';
  const cDark = '#3A2410';
  const cSeat = '#6B4828';

  function execChair(cx: number, cy: number, facing: string): void {
    if (facing === 'down') {
      S.rect(ctx, cx - 10, cy - 4, 20, 6, cBrown);
      S.rect(ctx, cx - 8, cy - 2, 16, 2, cDark);
      S.rect(ctx, cx - 10, cy + 2, 20, 14, cSeat);
      S.rect(ctx, cx - 8, cy + 4, 16, 10, cBrown);
      S.rect(ctx, cx - 12, cy, 4, 16, cDark);
      S.rect(ctx, cx + 8, cy, 4, 16, cDark);
    } else if (facing === 'up') {
      S.rect(ctx, cx - 10, cy, 20, 14, cSeat);
      S.rect(ctx, cx - 8, cy + 2, 16, 10, cBrown);
      S.rect(ctx, cx - 10, cy + 14, 20, 6, cBrown);
      S.rect(ctx, cx - 8, cy + 16, 16, 2, cDark);
      S.rect(ctx, cx - 12, cy, 4, 18, cDark);
      S.rect(ctx, cx + 8, cy, 4, 18, cDark);
    } else if (facing === 'left') {
      S.rect(ctx, cx, cy - 8, 14, 18, cSeat);
      S.rect(ctx, cx + 2, cy - 6, 10, 14, cBrown);
      S.rect(ctx, cx + 14, cy - 10, 6, 22, cBrown);
      S.rect(ctx, cx + 16, cy - 8, 2, 18, cDark);
      S.rect(ctx, cx, cy - 10, 14, 4, cDark);
      S.rect(ctx, cx, cy + 8, 14, 4, cDark);
    }
  }

  for (let i = 0; i < 3; i++) {
    const ax = tx + 28 + i * Math.floor(tw / 3);
    execChair(ax, ty - 18, 'down');
  }
  for (let i = 0; i < 3; i++) {
    const ax = tx + 28 + i * Math.floor(tw / 3);
    execChair(ax, ty + th + 4, 'up');
  }
  execChair(tx + tw + 8, ty + th / 2 - 2, 'left');

  S.drawWaterCooler(ctx, r.x + r.w - 28, r.y + r.h - 56);
  S.drawLabelBg(ctx, 'BOARD ROOM', r.x + r.w / 2, r.y - 20, 12, P.textWhite);
  S.drawRoomWalls(ctx, r);
}

// ═══════════════════════════════════════════
// Hallways
// ═══════════════════════════════════════════
function drawHallways(ctx: CanvasRenderingContext2D): void {
  const ht = ROOMS.hallT;
  const hb = ROOMS.hallB;
  const hl = ROOMS.hallL;
  const hr = ROOMS.hallR;
  const G = GAP;

  S.drawTileFloor(ctx, ht.x - G, ht.y - G, ht.w + G * 2, ht.h + G * 2);
  S.drawTileFloor(ctx, hb.x - G, hb.y - G, hb.w + G * 2, hb.h + G * 2);
  S.drawTileFloor(ctx, hl.x - G, hl.y - G, hl.w + G * 2, hl.h + G * 2);
  S.drawTileFloor(ctx, hr.x - G, hr.y - G, hr.w + G * 2, hr.h + G * 2);

  S.drawPlant(ctx, hl.x + 12, hl.y + 8, 1);
  S.drawPlant(ctx, hr.x + 12, hr.y + 8, 1);
}

// ═══════════════════════════════════════════
// Main scene draw — exported
// ═══════════════════════════════════════════
export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number): void {
  S.rect(ctx, 0, 0, w, h, P.border);
  S.drawTileFloor(ctx, 0, 0, GAME_W, GAME_H);
  drawHallways(ctx);
  drawBoardroom(ctx, frame);
  ['isaac', 'billy', 'patrik', 'marcos', 'sandra', 'charlie', 'wendy'].forEach(key => {
    drawOffice(ctx, key, frame);
  });
}

// ═══════════════════════════════════════════
// Hit detection
// ═══════════════════════════════════════════
export function hitTest(gx: number, gy: number): string | null {
  for (const [key, r] of Object.entries(ROOMS)) {
    if (gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h) {
      return key;
    }
  }
  return null;
}
