/**
 * Pixel-art scene composition — draws all offices, boardroom, and hallways.
 * Ported from TEST PIXEL TEAM's scene.js
 */
import { P } from './palette';
import * as S from './pixelSprites';
import { useEditorStore } from '@/store/editorStore';

import type { RoomRect, AgentAppearance } from './pixelSprites';

// Agent accent colors for room headers
const ROOM_ACCENTS: Record<string, string> = {
  isaac:   '#60a5fa', // blue — developer
  billy:   '#fbbf24', // gold — CEO
  patrik:  '#34d399', // teal — CFO
  marcos:  '#a78bfa', // purple — lawyer
  sandra:  '#f472b6', // pink — line producer
  charlie: '#fb923c', // orange — designer
  wendy:   '#c084fc', // purple — coach
  board:   '#e2e8f0', // white — boardroom
};
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
  charlie: { name: 'CHARLIE', role: 'MARKETING',    hair: 'hairBlonde', shirt: 'shirtOrange', status: 'idle' },
  wendy:   { name: 'WENDY',   role: 'COACH',         hair: 'hairBrown',  shirt: 'shirtPurple', status: 'meeting' },
};

// ═══════════════════════════════════════════
// Draw individual office
// ═══════════════════════════════════════════
function drawOffice(ctx: CanvasRenderingContext2D, key: string, frame: number): void {
  const r = ROOMS[key];
  const a = AGENTS[key];
  if (!r || !a) return;

  // Visibility helper — returns true if this piece has NOT been hidden by the user
  const hidden = useEditorStore.getState().hiddenHandDrawn;
  const vis = (id: string) => !hidden.has(`${key}.${id}`);

  S.drawRoomBase(ctx, r, P.wallTeal, P.floorWood);
  const wallH = Math.round(r.h * 0.32);
  const floorY = r.y + wallH;

  // ─── Isaac (Development — dual monitors, messy desk) ───
  if (key === 'isaac') {
    if (vis('window'))         S.drawWindow(ctx, r.x + 20, r.y + 12, 48, 40);
    if (vis('wallArt'))        S.drawWallArt(ctx, r.x + 84, r.y + 16, 28, 20);
    if (vis('clock'))          S.drawClock(ctx, r.x + 124, r.y + 16, frame);
    if (vis('bookshelf'))      S.drawBookshelf(ctx, r.x + 160, r.y + 8);
    if (vis('desk'))           S.drawDesk(ctx, r.x + 20, floorY + 36, 88, 28, 'right');
    if (vis('monitor1'))       S.drawMonitor(ctx, r.x + 32, floorY + 8);
    if (vis('monitor2'))       S.drawMonitor(ctx, r.x + 64, floorY + 8, P.screenGreen);
    if (vis('mug'))            S.drawMug(ctx, r.x + 96, floorY + 40, P.shirtBlue);
    if (vis('chair'))          S.drawChair(ctx, r.x + 48, floorY + 72);
    if (vis('filingCabinet'))  S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 8);
    if (vis('fileTable'))      S.drawFileTable(ctx, r.x + r.w - 68, floorY + 72);
    if (vis('plant'))          S.drawPlant(ctx, r.x + r.w - 32, floorY + 76, 1);
    if (vis('trashCan'))       S.drawTrashCan(ctx, r.x + r.w - 20, floorY + 120);
  }

  // ─── Billy (CEO — executive desk, big windows, plant pair) ───
  if (key === 'billy') {
    if (vis('window1'))        S.drawWindow(ctx, r.x + 48, r.y + 12, 52, 40);
    if (vis('window2'))        S.drawWindow(ctx, r.x + r.w - 108, r.y + 12, 52, 40);
    if (vis('wallArt'))        S.drawWallArt(ctx, r.x + r.w / 2 - 16, r.y + 12, 32, 24);
    if (vis('clock'))          S.drawClock(ctx, r.x + r.w / 2 + 28, r.y + 16, frame);
    if (vis('bookshelf'))      S.drawBookshelf(ctx, r.x + 12, r.y + 8);
    if (vis('desk'))           S.drawDesk(ctx, r.x + r.w / 2 - 64, floorY + 32, 128, 32, 'right');
    if (vis('monitor'))        S.drawMonitor(ctx, r.x + r.w / 2 - 16, floorY + 4);
    if (vis('mug'))            S.drawMug(ctx, r.x + r.w / 2 + 24, floorY + 40, P.textWhite);
    if (vis('chair'))          S.drawChair(ctx, r.x + r.w / 2 - 8, floorY + 72);
    if (vis('plant1'))         S.drawPlant(ctx, r.x + 12, floorY + 12, 2);
    if (vis('plant2'))         S.drawPlant(ctx, r.x + r.w - 40, floorY + 12, 2);
    if (vis('fileTable'))      S.drawFileTable(ctx, r.x + 56, floorY + 72);
    if (vis('filingCabinet'))  S.drawFilingCabinet(ctx, r.x + r.w - 44, floorY + 68);
    if (vis('trashCan'))       S.drawTrashCan(ctx, r.x + r.w / 2 + 60, floorY + 100);
  }

  // ─── Patrik (CFO — bookshelves, organized) ───
  if (key === 'patrik') {
    if (vis('window'))          S.drawWindow(ctx, r.x + r.w - 72, r.y + 12, 48, 40);
    if (vis('bookshelf1'))      S.drawBookshelf(ctx, r.x + 12, r.y + 8);
    if (vis('bookshelf2'))      S.drawBookshelf(ctx, r.x + 64, r.y + 8);
    if (vis('clock'))           S.drawClock(ctx, r.x + 120, r.y + 16, frame);
    if (vis('desk'))            S.drawDesk(ctx, r.x + r.w - 124, floorY + 36, 88, 28, 'left');
    if (vis('monitor'))         S.drawMonitor(ctx, r.x + r.w - 104, floorY + 8);
    if (vis('mug'))             S.drawMug(ctx, r.x + r.w - 120, floorY + 40, P.shirtGreen);
    if (vis('chair'))           S.drawChair(ctx, r.x + r.w - 88, floorY + 72);
    if (vis('filingCabinet1'))  S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 80);
    if (vis('filingCabinet2'))  S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 8);
    if (vis('fileTable'))       S.drawFileTable(ctx, r.x + 16, floorY + 72);
    if (vis('plant'))           S.drawPlant(ctx, r.x + 16, floorY + 100, 1);
  }

  // ─── Marcos (Lawyer — lots of books, framed certificates) ───
  if (key === 'marcos') {
    if (vis('window'))          S.drawWindow(ctx, r.x + 20, r.y + 12, 48, 40);
    if (vis('wallArt1'))        S.drawWallArt(ctx, r.x + 84, r.y + 16, 24, 20);
    if (vis('wallArt2'))        S.drawWallArt(ctx, r.x + 116, r.y + 16, 24, 20);
    if (vis('bookshelf1'))      S.drawBookshelf(ctx, r.x + 160, r.y + 8);
    if (vis('bookshelf2'))      S.drawBookshelf(ctx, r.x + 212, r.y + 8);
    if (vis('clock'))           S.drawClock(ctx, r.x + r.w - 28, r.y + 20, frame);
    if (vis('desk'))            S.drawDesk(ctx, r.x + 20, floorY + 48, 80, 28, 'right');
    if (vis('monitor'))         S.drawMonitor(ctx, r.x + 36, floorY + 20);
    if (vis('mug'))             S.drawMug(ctx, r.x + 72, floorY + 52, P.shirtRed);
    if (vis('chair'))           S.drawChair(ctx, r.x + 44, floorY + 84);
    if (vis('filingCabinet1'))  S.drawFilingCabinet(ctx, r.x + 12, floorY + 20);
    if (vis('filingCabinet2'))  S.drawFilingCabinet(ctx, r.x + 12, floorY + 76);
    if (vis('fileTable'))       S.drawFileTable(ctx, r.x + r.w - 40, floorY + 108);
    if (vis('plant'))           S.drawPlant(ctx, r.x + 8, floorY + 160, 1);
    if (vis('trashCan'))        S.drawTrashCan(ctx, r.x + 124, floorY + 160);
  }

  // ─── Sandra (Line Producer — organized, whiteboards) ───
  if (key === 'sandra') {
    if (vis('window'))          S.drawWindow(ctx, r.x + r.w - 72, r.y + 12, 48, 40);
    if (vis('whiteboard'))      S.drawWhiteboard(ctx, r.x + 16, r.y + 12, 56, 40);
    if (vis('bookshelf'))       S.drawBookshelf(ctx, r.x + 88, r.y + 8);
    if (vis('clock'))           S.drawClock(ctx, r.x + r.w - 28, r.y + 20, frame);
    if (vis('desk'))            S.drawDesk(ctx, r.x + r.w - 116, floorY + 48, 80, 28, 'left');
    if (vis('monitor'))         S.drawMonitor(ctx, r.x + r.w - 96, floorY + 20);
    if (vis('mug'))             S.drawMug(ctx, r.x + r.w - 56, floorY + 52, P.bookYellow);
    if (vis('chair'))           S.drawChair(ctx, r.x + r.w - 84, floorY + 84);
    if (vis('filingCabinet1'))  S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 20);
    if (vis('filingCabinet2'))  S.drawFilingCabinet(ctx, r.x + r.w - 40, floorY + 76);
    if (vis('fileTable'))       S.drawFileTable(ctx, r.x + 12, floorY + 108);
    if (vis('plant'))           S.drawPlant(ctx, r.x + r.w - 32, floorY + 160, 1);
    if (vis('trashCan'))        S.drawTrashCan(ctx, r.x + 52, floorY + 160);
  }

  // ─── Charlie (Marketing — art on walls, drawing table, colorful) ───
  if (key === 'charlie') {
    if (vis('window'))          S.drawWindow(ctx, r.x + 20, r.y + 12, 48, 40);
    if (vis('wallArt1'))        S.drawWallArt(ctx, r.x + 88, r.y + 16, 36, 28);
    if (vis('wallArt2'))        S.drawWallArt(ctx, r.x + 136, r.y + 20, 24, 20);
    if (vis('wallArt3'))        S.drawWallArt(ctx, r.x + 172, r.y + 16, 20, 24);
    if (vis('table'))           S.drawTable(ctx, r.x + 120, floorY + 28, 92, 44);
    if (vis('desk'))            S.drawDesk(ctx, r.x + 20, floorY + 32, 72, 24, 'right');
    if (vis('monitor'))         S.drawMonitor(ctx, r.x + 32, floorY + 8, '#c090d0');
    if (vis('mug'))             S.drawMug(ctx, r.x + 72, floorY + 36, P.shirtOrange);
    if (vis('chair'))           S.drawChair(ctx, r.x + 44, floorY + 64);
    if (vis('fileTable'))       S.drawFileTable(ctx, r.x + r.w - 36, floorY + 52);
    if (vis('plant'))           S.drawPlant(ctx, r.x + r.w - 32, floorY + 12, 1);
    if (vis('trashCan'))        S.drawTrashCan(ctx, r.x + r.w - 20, floorY + 104);
  }

  // ─── Wendy (Coach — couch, zen plant, whiteboard) ───
  if (key === 'wendy') {
    if (vis('window'))          S.drawWindow(ctx, r.x + r.w - 72, r.y + 12, 48, 40);
    if (vis('whiteboard'))      S.drawWhiteboard(ctx, r.x + 16, r.y + 12, 48, 36);
    if (vis('wallArt'))         S.drawWallArt(ctx, r.x + 76, r.y + 20, 28, 20);
    if (vis('clock'))           S.drawClock(ctx, r.x + r.w - 28, r.y + 20, frame);
    if (vis('desk'))            S.drawDesk(ctx, r.x + r.w - 116, floorY + 32, 80, 28, 'left');
    if (vis('monitor'))         S.drawMonitor(ctx, r.x + r.w - 92, floorY + 4);
    if (vis('mug'))             S.drawMug(ctx, r.x + r.w - 112, floorY + 36, P.shirtPurple);
    if (vis('chair'))           S.drawChair(ctx, r.x + r.w - 80, floorY + 68);
    if (vis('filingCabinet'))   S.drawFilingCabinet(ctx, r.x + 12, floorY + 12);
    if (vis('fileTable'))       S.drawFileTable(ctx, r.x + 36, floorY + 60);
    if (vis('couch'))           S.drawCouch(ctx, r.x + 76, floorY + 96);
    if (vis('trashCan'))        S.drawTrashCan(ctx, r.x + r.w - 20, floorY + 104);
    if (vis('plant'))           S.drawPlant(ctx, r.x + r.w - 32, floorY + 100, 2);
  }

  // Agent name + role header banner
  const accent = ROOM_ACCENTS[key] ?? '#fbbf24';
  S.drawRoomHeader(ctx, a.name, a.role, r.x + r.w / 2, r.y - 6, accent, r.w);

  // Room walls with door
  S.drawRoomWalls(ctx, r);
}


// ═══════════════════════════════════════════
// Boardroom
// ═══════════════════════════════════════════
function drawBoardroom(ctx: CanvasRenderingContext2D, frame: number): void {
  const r = ROOMS.board;
  if (!r) return;
  const wallH = Math.round(r.h * 0.25);

  // Visibility helper — same pattern as drawOffice
  const hidden = useEditorStore.getState().hiddenHandDrawn;
  const vis = (id: string) => !hidden.has(`boardroom.${id}`);

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

  if (vis('presScreen'))  S.drawPresScreen(ctx, r.x + 72, r.y + 8, 88, 56);
  if (vis('whiteboard'))  S.drawWhiteboard(ctx, r.x + r.w - 160, r.y + 12, 76, 48);
  if (vis('sconceL'))     S.drawSconce(ctx, r.x + 36, r.y + 16, frame);
  if (vis('sconceR'))     S.drawSconce(ctx, r.x + r.w - 44, r.y + 16, frame);

  const fullW = r.w - 200, fullH = r.h - wallH - 100;
  const tw = Math.round(fullW * 0.8), th = Math.round(fullH * 0.8);
  const tx = r.x + 100 + Math.round((fullW - tw) / 2);
  const ty = r.y + wallH + 40 + Math.round((fullH - th) / 2);
  if (vis('table'))       S.drawBoardTable(ctx, tx, ty, tw, th);

  if (vis('chairs')) {
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
  }

  if (vis('waterCooler')) S.drawWaterCooler(ctx, r.x + r.w - 28, r.y + r.h - 56);
  S.drawRoomHeader(ctx, 'BOARD ROOM', 'WAR ROOM', r.x + r.w / 2, r.y - 6, ROOM_ACCENTS['board'] ?? '#e2e8f0', r.w);
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
  if (!ht || !hb || !hl || !hr) return;
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
