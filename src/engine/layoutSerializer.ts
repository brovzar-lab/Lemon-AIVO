/**
 * Layout serialization, IndexedDB persistence, and JSON export/import.
 *
 * Serializes the current tile map, furniture, decorations, and room definitions
 * into a portable LayoutData format. Supports auto-save to IndexedDB on editor
 * "Done" and manual JSON export/import for backup and sharing.
 */
import { TileType } from './types';
import { OFFICE_TILE_MAP, FURNITURE, DECORATIONS, ROOMS, ROOM_RUGS, DEFAULT_FURNITURE, setTile, getCollisionExemptions, TILE_STYLES, setTileStyle } from './officeLayout';
import type { FurnitureItem } from './officeLayout';
import { rebuildCollisionOverlay } from './tileMap';

// ── Layout Data Format ──────────────────────────────────────────────────────

export interface LayoutData {
  version: number;
  gridCols: number;
  gridRows: number;
  tileMap: number[][];
  furniture: SerializedFurniture[];
  decorations: SerializedDecoration[];
  rooms: SerializedRoom[];
  rugs: SerializedRug[];
  tileStyles?: Record<string, string>;  // "col,row" → atlasKey (e.g. "5,3": "floor-wood-dark") — comma separator matches native setTileStyle key format
}

interface SerializedFurniture {
  roomId: string;
  type: string;
  col: number;
  row: number;
  width: number;
  height: number;
  atlasKey?: string;
  spriteRows?: number;
  rotation?: 0 | 90 | 180 | 270;
}

interface SerializedDecoration {
  roomId: string;
  key: string;
  col: number;
  row: number;
}

interface SerializedRoom {
  id: string;
  name: string;
  col: number;
  row: number;
  width: number;
  height: number;
  doorCol: number;
  doorRow: number;
  seatCol: number;
  seatRow: number;
  billyStandCol: number;
  billyStandRow: number;
}

interface SerializedRug {
  roomId: string;
  col: number;
  row: number;
  w: number;
  h: number;
  color: string;
  borderColor: string;
}

const LAYOUT_VERSION = 1;
const IDB_DB_NAME = 'boiler-room-layout';
const IDB_STORE_NAME = 'layouts';
const IDB_KEY = 'current';

// ── Serialize ───────────────────────────────────────────────────────────────

export function serializeLayout(): LayoutData {
  const gridRows = OFFICE_TILE_MAP.length;
  const gridCols = gridRows > 0 ? OFFICE_TILE_MAP[0]!.length : 0;

  // Convert tile map to plain numbers
  const tileMap: number[][] = [];
  for (let r = 0; r < gridRows; r++) {
    const row: number[] = [];
    for (let c = 0; c < gridCols; c++) {
      row.push(OFFICE_TILE_MAP[r]![c]! as number);
    }
    tileMap.push(row);
  }

  const furniture: SerializedFurniture[] = FURNITURE.map((f) => ({
    roomId: f.roomId,
    type: f.type,
    col: f.col,
    row: f.row,
    width: f.width,
    height: f.height,
    atlasKey: f.atlasKey,
    spriteRows: f.spriteRows,
    rotation: f.rotation,
  }));

  const decorations: SerializedDecoration[] = DECORATIONS.map((d) => ({
    roomId: d.roomId,
    key: d.key,
    col: d.col,
    row: d.row,
  }));

  const rooms: SerializedRoom[] = ROOMS.map((r) => ({
    id: r.id,
    name: r.name,
    col: r.tileRect.col,
    row: r.tileRect.row,
    width: r.tileRect.width,
    height: r.tileRect.height,
    doorCol: r.doorTile.col,
    doorRow: r.doorTile.row,
    seatCol: r.seatTile.col,
    seatRow: r.seatTile.row,
    billyStandCol: r.billyStandTile.col,
    billyStandRow: r.billyStandTile.row,
  }));

  const rugs: SerializedRug[] = ROOM_RUGS.map((r) => ({
    roomId: r.roomId,
    col: r.col,
    row: r.row,
    w: r.w,
    h: r.h,
    color: r.color,
    borderColor: r.borderColor,
  }));

  return {
    version: LAYOUT_VERSION,
    gridCols,
    gridRows,
    tileMap,
    furniture,
    decorations,
    rooms,
    rugs,
    tileStyles: TILE_STYLES.size > 0
      ? Object.fromEntries(TILE_STYLES.entries())
      : undefined,
  };
}

// ── Deserialize ─────────────────────────────────────────────────────────────

export function deserializeLayout(data: LayoutData): void {
  // Guard: skip deserialization if the saved grid dimensions do not match the
  // current static layout. A dimension mismatch means the layout was saved with
  // a different room arrangement (e.g. an earlier 42×36 grid vs the current
  // 45×38 grid). Applying a mismatched tile map would overwrite current door
  // positions with old wall tiles, corrupting corridors and making rooms
  // unreachable. In this case the static defaults are the correct baseline.
  const currentRows = OFFICE_TILE_MAP.length;
  const currentCols = OFFICE_TILE_MAP[0]?.length ?? 0;
  if (data.gridRows !== currentRows || data.gridCols !== currentCols) {
    return;
  }

  // Apply tile map
  for (let r = 0; r < data.gridRows && r < OFFICE_TILE_MAP.length; r++) {
    for (let c = 0; c < data.gridCols && c < OFFICE_TILE_MAP[0]!.length; c++) {
      setTile(c, r, data.tileMap[r]![c]! as TileType);
    }
  }

  // Apply furniture
  FURNITURE.length = 0;
  for (const f of data.furniture) {
    FURNITURE.push({
      roomId: f.roomId,
      type: f.type as FurnitureItem['type'],
      col: f.col,
      row: f.row,
      width: f.width,
      height: f.height,
      atlasKey: f.atlasKey,
      spriteRows: f.spriteRows,
      rotation: f.rotation,
    });
  }

  // Migration: normalize conference table to canonical dimensions.
  // Old layouts may have width=5/height=3 (from a previous fix attempt) or width=6/height=7
  // without spriteRows. Canonical is width=6, height=7, spriteRows=3 so the collision
  // covers the full visual area while the depth-sort key matches the sprite height.
  for (const f of FURNITURE) {
    if (f.roomId === 'war-room' && f.type === 'table' && f.col === 20 && f.row === 18) {
      f.width = 6;
      f.height = 7;
      f.spriteRows = 3;
      if (!f.atlasKey) f.atlasKey = 'conf-table';
    }
  }

  // Merge hardcoded default furniture (e.g. War Room conference items) that
  // may not exist in the saved layout. This ensures code-defined items always
  // appear even when the IDB save predates them.
  for (const dflt of DEFAULT_FURNITURE) {
    const exists = FURNITURE.some(f =>
      f.atlasKey === dflt.atlasKey &&
      f.roomId  === dflt.roomId  &&
      f.col     === dflt.col     &&
      f.row     === dflt.row
    );
    if (!exists) {
      FURNITURE.push({ ...dflt });
    }
  }

  // Rebuild collision overlay after restoring furniture so pathfinding reflects
  // the loaded furniture state. Must be done here because FURNITURE was replaced
  // via direct push (not addFurniture), so no earlier rebuild occurred.
  rebuildCollisionOverlay(
    FURNITURE,
    getCollisionExemptions(),
    OFFICE_TILE_MAP.length,
    OFFICE_TILE_MAP[0]?.length ?? 0,
  );

  // Apply decorations
  DECORATIONS.length = 0;
  for (const d of data.decorations) {
    DECORATIONS.push({
      roomId: d.roomId,
      key: d.key,
      col: d.col,
      row: d.row,
    });
  }

  // Apply rugs
  ROOM_RUGS.length = 0;
  for (const r of data.rugs) {
    ROOM_RUGS.push({
      roomId: r.roomId,
      col: r.col,
      row: r.row,
      w: r.w,
      h: r.h,
      color: r.color,
      borderColor: r.borderColor,
    });
  }

  // Tile styles
  TILE_STYLES.clear();  // Must clear first — avoids stale styles from current session surviving into loaded layout
  if (data.tileStyles) {
    for (const [key, atlasKey] of Object.entries(data.tileStyles)) {
      const parts = key.split(',');
      const col = parseInt(parts[0]!, 10);
      const row = parseInt(parts[1]!, 10);
      if (!isNaN(col) && !isNaN(row)) {
        setTileStyle(col, row, atlasKey);
      }
    }
  }

  // Room definitions (tileRect, doorTile, seatTile, billyStandTile) are NOT
  // restored from IDB. They are determined by static code in officeLayout.ts
  // and are not user-editable via the layout editor. Restoring them from saved
  // data could overwrite current code values with stale coordinates — which is
  // exactly what caused this bug (billyStandTile reverted to a position inside
  // the conference table after the phase 15 fix moved it). Room names are also
  // skipped for consistency: the serialized rooms field is retained in the data
  // format for forward compatibility but is intentionally not applied.
}

// ── JSON Export/Import ──────────────────────────────────────────────────────

export function exportLayoutJSON(): string {
  return JSON.stringify(serializeLayout(), null, 2);
}

export function importLayoutJSON(json: string): LayoutData {
  const data = JSON.parse(json) as LayoutData;
  if (!data.version || !data.tileMap || !Array.isArray(data.tileMap)) {
    throw new Error('Invalid layout file');
  }
  return data;
}

export function downloadLayoutJSON(): void {
  const json = exportLayoutJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lemon-office-layout.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── IndexedDB Persistence ───────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLayoutToIDB(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
  const store = tx.objectStore(IDB_STORE_NAME);
  const data = serializeLayout();
  store.put(data, IDB_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLayoutFromIDB(): Promise<LayoutData | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.get(IDB_KEY);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as LayoutData | null ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}
