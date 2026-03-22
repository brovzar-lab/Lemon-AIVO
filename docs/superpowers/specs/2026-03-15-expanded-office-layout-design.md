# Expanded Office Layout Design

## Goal
Grow all office rooms from 7×7 to 9×9 tiles and the War Room from 12×11 to 16×13, giving agents 2× the floor space for furniture placement and movement.

## Grid Dimensions
- **Current:** 32 cols × 30 rows (960 tiles)
- **New:** 42 cols × 36 rows (~1512 tiles)

## Room Sizes

| Room | Current | New | Interior | Tiles |
|------|---------|-----|----------|-------|
| Billy | 7×7 | 9×9 | 7×7 | 49 |
| Patrik | 7×7 | 9×9 | 7×7 | 49 |
| Sandra | 7×7 | 9×9 | 7×7 | 49 |
| Marcos | 7×7 | 9×9 | 7×7 | 49 |
| Isaac | 7×7 | 9×9 | 7×7 | 49 |
| Wendy | 7×7 | 9×9 | 7×7 | 49 |
| War Room | 12×11 | 16×13 | 14×11 | 154 |
| Rec Area | 12×4 | 16×5 | 16×5 | 80 |

## Column Layout

| Cols | Content |
|------|---------|
| 0 | VOID border |
| 1–9 | Left offices (Sandra, Isaac) — 9 wide |
| 10–11 | Left vertical corridor — 2 wide |
| 12–20 | Billy's Office — 9 wide (top row, center-left) |
| 21–29 | Patrik's Office — 9 wide (top row, center-right) |
| 12–27 | War Room — 16 wide (centered under Billy+Patrik) |
| 30–31 | Right vertical corridor — 2 wide |
| 32–40 | Right offices (Marcos, Wendy) — 9 wide |
| 41 | VOID border |

## Row Layout

| Rows | Content |
|------|---------|
| 0–1 | VOID headroom |
| 2–10 | Top offices (Billy, Patrik) — 9 tall |
| 11–12 | Upper horizontal corridor — 2 tall |
| 13–21 | Upper side offices (Sandra left, Marcos right) — 9 tall |
| 14–26 | War Room — 13 tall (overlaps upper+lower side office zones) |
| 22–23 | Mid corridor between upper/lower side offices |
| 24–32 | Lower side offices (Isaac left, Wendy right) — 9 tall |
| 27–31 | Rec area below War Room — 16×5 (open plan, no walls) |
| 33–34 | Lower horizontal corridor — 2 tall |
| 35 | VOID border |

## Room Positions (col, row, width, height)

- **Billy:** (12, 2, 9, 9) — door at south wall center
- **Patrik:** (21, 2, 9, 9) — door at south wall center
- **Sandra:** (1, 13, 9, 9) — door on east wall
- **Marcos:** (32, 13, 9, 9) — door on west wall
- **Isaac:** (1, 24, 9, 9) — door on east wall
- **Wendy:** (32, 24, 9, 9) — door on west wall
- **War Room:** (12, 14, 16, 13) — doors on north and south walls (2-wide)

## Corridors

- **Upper horizontal:** rows 11–12, cols 1–40 (full width)
- **Lower horizontal:** rows 33–34, cols 1–40 (full width)
- **Left vertical:** cols 10–11, rows 11–34
- **Right vertical:** cols 30–31, rows 11–34
- **Mid horizontal (left):** rows 22–23, cols 1–9
- **Mid horizontal (right):** rows 22–23, cols 32–40
- **War Room connector (north):** row 13, cols 12–27

## Rec Area

- **Bounds:** cols 12–27, rows 27–31 (open plan below War Room south wall)
- No walls — floor tiles only, connected to lower corridors

## Files Modified

- `src/engine/officeLayout.ts` — `GRID_COLS`, `GRID_ROWS`, `buildTileMap()`, `ROOMS`, `WAR_ROOM_SEATS`, `REC_AREA_BOUNDS`, all furniture/decoration positions (currently empty arrays)
- No renderer changes needed — reads tile map dynamically

## What Stays the Same

- Tile size (16px), sprite sizes, atlas coordinates
- Room arrangement pattern (same spatial relationships)
- Corridor width (2 tiles)
- All rendering, pathfinding, and movement logic (reads from OFFICE_TILE_MAP)
- FURNITURE and DECORATIONS arrays (currently empty, will be populated separately)
