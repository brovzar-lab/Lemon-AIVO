/**
 * 32-color pixel art palette matching the office scene reference.
 * Ported from TEST PIXEL TEAM's palette.js
 */
export const P = {
  // Dark borders between rooms
  border: '#0f0e1a',
  // Walls
  wallTeal: '#8BA888', wallTealDark: '#7B9878', wallTealLight: '#9BB898',
  wallBeige: '#c4b594', wallBeigeDark: '#a49a7a', wallCream: '#d4c5a0',
  // Floors
  floorWood: '#9B7824', floorWoodLight: '#B08A30', floorWoodDark: '#7B5818',
  floorWoodPlank: '#8A6C20',
  floorCarpet: '#404045', floorCarpetLight: '#505055',
  floorStone: '#606878', floorStoneLight: '#707880', floorStoneDark: '#505860',
  floorTile: '#A09080', floorTileLight: '#B0A090', floorTileDark: '#908070',
  // Furniture
  deskWood: '#6b4a2e', deskLight: '#8b6240', deskDark: '#4b3018',
  tableWood: '#7a5232', tableDark: '#5a3a1e',
  chairBrown: '#5a3a1e', chairDark: '#3a2810',
  // Plants
  plantGreen: '#3a7a2e', plantLight: '#50a040', plantDark: '#2a5a1e',
  potBrown: '#6b4a2a', potDark: '#4a3018',
  // Characters
  skin: '#e8c090', skinDark: '#c89870',
  hairBrown: '#4a2a10', hairBlack: '#1a1a2a', hairRed: '#8a3020',
  hairBlonde: '#c8a840', hairGray: '#707080',
  shirtBlue: '#3464a8', shirtGreen: '#3a6a3a', shirtRed: '#8a3a3a',
  shirtWhite: '#c8c8d0', shirtPurple: '#6a3a8a', shirtOrange: '#c07030',
  pants: '#2a3050', pantsBrown: '#4a3828',
  // Office items
  monitorGray: '#3a3a44', screenBlue: '#5090c0', screenGreen: '#50a050',
  cabinetGray: '#6a6a7a', cabinetDark: '#4a4a5a',
  shelfWood: '#5a3a1e', shelfDark: '#3a2410',
  bookRed: '#8a3030', bookBlue: '#304488', bookGreen: '#308830', bookYellow: '#a89030',
  windowFrame: '#5a4a3a', skyBlue: '#80b4e0', treesGreen: '#408040',
  whiteboard: '#e0e0e0', wbFrame: '#5a5a5a',
  // Room walls (brown borders)
  wallBrown: '#6b4a2e', wallBrownDark: '#4b3018', wallBrownLight: '#8b6240',
  doorFrame: '#7a5a3a',
  // Misc
  rugPurple: '#4a3860', rugBorder: '#3a2850', rugLight: '#5a4870',
  couchRed: '#8a4030', couchDark: '#6a2a1a',
  textWhite: '#ffffff', textCream: '#e0d8c0', textShadow: '#000000',
  labelBg: '#1a192e',
} as const;

export type PaletteColor = typeof P[keyof typeof P];
