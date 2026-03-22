/**
 * Curated furniture catalog — named, categorised items for the editor browser.
 *
 * Each entry maps to:
 *  - `atlasKey`   : existing LIMEZU_ATLAS key (16×16 coords, used by the renderer)
 *  - `atlasKey48` : new atlas key at 3× resolution (48×48 coords, used for thumbnails)
 *  - `name`       : human-readable name shown on hover
 *  - `category`   : for the category filter tabs
 *  - `defaultSize`: collision footprint in tiles to pre-fill when placing
 */

export type FurnitureCategory =
  | 'Desks'
  | 'Chairs & Seating'
  | 'Tables'
  | 'Plants'
  | 'Storage'
  | 'Tech & Screens'
  | 'Boards & Signs'
  | 'Decor'
  | 'Film Studio';

export const FURNITURE_CATEGORIES_ORDERED: FurnitureCategory[] = [
  'Desks',
  'Chairs & Seating',
  'Tables',
  'Plants',
  'Storage',
  'Tech & Screens',
  'Boards & Signs',
  'Decor',
  'Film Studio',
];

export interface FurnitureDef {
  atlasKey: string;        // 16×16 key — used by the renderer for actual placement
  atlasKey48: string;      // 48×48 key — used for the editor thumbnail preview
  name: string;
  category: FurnitureCategory;
  description?: string;
  defaultW: number;        // default collision width in tiles
  defaultH: number;        // default collision height in tiles
}

export const FURNITURE_DEFS: FurnitureDef[] = [
  // ── Desks ─────────────────────────────────────────────────────────────────
  {
    atlasKey: 'desk-wood-2wide', atlasKey48: 'desk-wood-2wide-48',
    name: 'Wood Desk', category: 'Desks',
    description: 'Standard orange/wood office desk (top-down view)',
    defaultW: 2, defaultH: 3,
  },
  {
    atlasKey: 'desk-wood-3wide', atlasKey48: 'desk-wood-3wide-48',
    name: 'Long Wood Desk', category: 'Desks',
    description: 'Wide 4-tile light-wood desk',
    defaultW: 4, defaultH: 3,
  },
  {
    atlasKey: 'desk-study', atlasKey48: 'desk-study-48',
    name: 'Study Desk', category: 'Desks',
    description: 'Corner study desk with shelves',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'desk-lamp', atlasKey48: 'desk-lamp-48',
    name: 'Desk Lamp', category: 'Desks',
    description: 'Small desk lamp accessory',
    defaultW: 1, defaultH: 1,
  },
  {
    atlasKey: 'keyboard', atlasKey48: 'keyboard-48',
    name: 'Keyboard', category: 'Desks',
    description: 'Computer keyboard',
    defaultW: 1, defaultH: 1,
  },
  {
    atlasKey: 'phone-desk', atlasKey48: 'phone-desk-48',
    name: 'Desk Phone', category: 'Desks',
    description: 'Office desk telephone',
    defaultW: 1, defaultH: 1,
  },

  // ── Chairs & Seating ──────────────────────────────────────────────────────
  {
    atlasKey: 'chair-office', atlasKey48: 'chair-office-48',
    name: 'Office Chair', category: 'Chairs & Seating',
    description: 'Round golden-tan office chair (top-down)',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'conf-chair', atlasKey48: 'conf-chair-48',
    name: 'Conference Chair', category: 'Chairs & Seating',
    description: 'Padded conference room chair',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'armchair', atlasKey48: 'armchair-48',
    name: 'Armchair', category: 'Chairs & Seating',
    description: 'Comfortable lounge armchair',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'director-chair', atlasKey48: 'director-chair-48',
    name: 'Director Chair', category: 'Chairs & Seating',
    description: 'Folding director\'s canvas chair',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'couch-2wide', atlasKey48: 'couch-2wide-48',
    name: 'Sofa (3-wide)', category: 'Chairs & Seating',
    description: 'Comfortable 3-seat office sofa',
    defaultW: 3, defaultH: 2,
  },
  {
    atlasKey: 'cushion', atlasKey48: 'cushion-48',
    name: 'Floor Cushion', category: 'Chairs & Seating',
    description: 'Decorative floor cushion',
    defaultW: 1, defaultH: 1,
  },

  // ── Tables ────────────────────────────────────────────────────────────────
  {
    atlasKey: 'conf-table', atlasKey48: 'conf-table-48',
    name: 'Conference Table', category: 'Tables',
    description: 'Large 5×3 tile conference room table',
    defaultW: 6, defaultH: 7,
  },
  {
    atlasKey: 'coffee-table', atlasKey48: 'coffee-table-48',
    name: 'Coffee Table', category: 'Tables',
    description: 'Low 2-tile wide coffee table',
    defaultW: 2, defaultH: 1,
  },

  // ── Plants ────────────────────────────────────────────────────────────────
  {
    atlasKey: 'plant-large', atlasKey48: 'plant-large-48',
    name: 'Large Plant', category: 'Plants',
    description: 'Large decorative indoor plant',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'plant-potted', atlasKey48: 'plant-potted-48',
    name: 'Potted Plant', category: 'Plants',
    description: 'Small potted plant',
    defaultW: 1, defaultH: 1,
  },
  {
    atlasKey: 'desk-plant', atlasKey48: 'desk-plant-48',
    name: 'Desk Plant', category: 'Plants',
    description: 'Tiny plant for the desk',
    defaultW: 1, defaultH: 1,
  },

  // ── Storage ───────────────────────────────────────────────────────────────
  {
    atlasKey: 'filing-cabinet', atlasKey48: 'filing-cabinet-48',
    name: 'Filing Cabinet', category: 'Storage',
    description: 'Metal filing cabinet with 2 drawers',
    defaultW: 1, defaultH: 2,
  },
  {
    atlasKey: 'cabinet-2wide', atlasKey48: 'cabinet-2wide-48',
    name: 'Cabinet (2-wide)', category: 'Storage',
    description: 'Wide wooden storage cabinet',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'shelf-wall', atlasKey48: 'shelf-wall-48',
    name: 'Wall Shelf', category: 'Storage',
    description: 'Mounted wall shelf unit',
    defaultW: 2, defaultH: 1,
  },
  {
    atlasKey: 'bookshelf-2tall', atlasKey48: 'bookshelf-2tall-48',
    name: 'Bookshelf (2-wide)', category: 'Storage',
    description: 'Standard 2-wide bookshelf',
    defaultW: 2, defaultH: 2,
  },
  {
    atlasKey: 'bookshelf-library', atlasKey48: 'bookshelf-library-48',
    name: 'Library Shelf', category: 'Storage',
    description: 'Large 3×3 library bookshelf unit',
    defaultW: 3, defaultH: 3,
  },

  // ── Tech & Screens ────────────────────────────────────────────────────────
  {
    atlasKey: 'monitor', atlasKey48: 'monitor-48',
    name: 'Monitor', category: 'Tech & Screens',
    description: 'Desktop computer monitor',
    defaultW: 1, defaultH: 1,
  },
  {
    atlasKey: 'conf-projector', atlasKey48: 'conf-projector-48',
    name: 'Projector', category: 'Tech & Screens',
    description: 'Conference room overhead projector',
    defaultW: 2, defaultH: 1,
  },
  {
    atlasKey: 'studio-monitor', atlasKey48: 'studio-monitor-48',
    name: 'Studio Monitor', category: 'Tech & Screens',
    description: 'Professional studio monitoring screen',
    defaultW: 2, defaultH: 2,
  },

  // ── Boards & Signs ────────────────────────────────────────────────────────
  {
    atlasKey: 'whiteboard', atlasKey48: 'whiteboard-48',
    name: 'Whiteboard', category: 'Boards & Signs',
    description: 'Wall-mounted whiteboard',
    defaultW: 3, defaultH: 2,
  },
  {
    atlasKey: 'chalkboard', atlasKey48: 'chalkboard-48',
    name: 'Chalkboard', category: 'Boards & Signs',
    description: 'Traditional classroom chalkboard',
    defaultW: 3, defaultH: 2,
  },
  {
    atlasKey: 'conf-podium', atlasKey48: 'conf-podium-48',
    name: 'Podium', category: 'Boards & Signs',
    description: 'Presentation podium / lectern',
    defaultW: 2, defaultH: 2,
  },

  // ── Decor ─────────────────────────────────────────────────────────────────
  {
    atlasKey: 'water-cooler', atlasKey48: 'water-cooler-48',
    name: 'Water Cooler', category: 'Decor',
    description: 'Office water cooler dispenser',
    defaultW: 1, defaultH: 2,
  },
  {
    atlasKey: 'floor-lamp', atlasKey48: 'floor-lamp-48',
    name: 'Floor Lamp', category: 'Decor',
    description: 'Standing floor lamp',
    defaultW: 1, defaultH: 2,
  },
  {
    atlasKey: 'rug-office', atlasKey48: 'rug-office-48',
    name: 'Area Rug', category: 'Decor',
    description: '4×4 tile decorative area rug',
    defaultW: 4, defaultH: 4,
  },

  // ── Film Studio ───────────────────────────────────────────────────────────
  {
    atlasKey: 'camera', atlasKey48: 'camera-48',
    name: 'Film Camera', category: 'Film Studio',
    description: 'Professional film camera on tripod',
    defaultW: 2, defaultH: 3,
  },
  {
    atlasKey: 'studio-light', atlasKey48: 'studio-light-48',
    name: 'Studio Light', category: 'Film Studio',
    description: 'Professional studio lighting rig',
    defaultW: 2, defaultH: 3,
  },
  {
    atlasKey: 'clapboard', atlasKey48: 'clapboard-48',
    name: 'Clapboard', category: 'Film Studio',
    description: 'Film clapperboard / slate',
    defaultW: 2, defaultH: 1,
  },
  {
    atlasKey: 'film-reel', atlasKey48: 'film-reel-48',
    name: 'Film Reel', category: 'Film Studio',
    description: 'Film canister and reel',
    defaultW: 1, defaultH: 1,
  },
];

/** Lookup map: atlasKey → FurnitureDef */
export const FURNITURE_DEF_BY_KEY = new Map<string, FurnitureDef>(
  FURNITURE_DEFS.map((d) => [d.atlasKey, d])
);

/** All defs grouped by category */
export const FURNITURE_DEFS_BY_CATEGORY: Record<string, FurnitureDef[]> = {};
for (const def of FURNITURE_DEFS) {
  (FURNITURE_DEFS_BY_CATEGORY[def.category] ??= []).push(def);
}
