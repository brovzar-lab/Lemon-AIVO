"""
Extracts individual furniture sprites from LimeZu Generic_48x48.png.

Strategy: operate at the 48x48 CELL level.
- Build a pixel-count grid: how many alpha>10 pixels each 48x48 cell has.
- A cell-row is a "separator" if total pixels across all 16 cells is < ROW_THRESHOLD.
- A cell-column within a band is a "separator" if total pixels in that column < COL_THRESHOLD.
- Crop each resulting rectangle (aligned to 48px grid) and save as PNG.
"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(BASE, "public/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_48x48/1_Generic_48x48.png")
OUT_DIR = os.path.join(BASE, "public/sprites/modern-interiors-paid/1_Interiors/48x48/Theme_Sorter_Singles_48x48/1_Generic_Singles_48x48")

CELL = 48
ALPHA_THRESHOLD = 10   # pixels below this alpha are "empty"
ROW_THRESHOLD   = 50   # total pixels in a cell-row below this → separator row
COL_THRESHOLD   = 30   # total pixels in a cell-column below this → separator col
MIN_CELLS_WIDE  = 1    # minimum cell span to keep
MIN_CELLS_TALL  = 1

def cell_pixels(pix, c, r, W, H):
    """Count non-transparent pixels in cell (c, r)."""
    x0, y0 = c * CELL, r * CELL
    x1 = min(x0 + CELL, W)
    y1 = min(y0 + CELL, H)
    count = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pix[x, y][3] >= ALPHA_THRESHOLD:
                count += 1
    return count

def split_by_separators(sums, threshold):
    """Given list of sums, return (start, end) ranges where sum > threshold."""
    ranges, start = [], None
    for i, s in enumerate(sums):
        if s > threshold and start is None:
            start = i
        elif s <= threshold and start is not None:
            ranges.append((start, i))
            start = None
    if start is not None:
        ranges.append((start, len(sums)))
    return ranges

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # Clear existing extractions
    for f in os.listdir(OUT_DIR):
        if f.startswith("Generic_Singles_48x48_"):
            os.remove(os.path.join(OUT_DIR, f))

    img = Image.open(SHEET).convert("RGBA")
    W, H = img.size
    pix = img.load()
    cols_n = W // CELL
    rows_n = H // CELL
    print(f"Sheet: {W}x{H} = {cols_n} cols x {rows_n} rows at {CELL}px")

    # Build cell density grid
    print("Building cell density grid...")
    grid = [[cell_pixels(pix, c, r, W, H) for c in range(cols_n)] for r in range(rows_n)]

    # Row totals (sum across all columns)
    row_totals = [sum(grid[r]) for r in range(rows_n)]
    # Split into horizontal bands
    h_bands = split_by_separators(row_totals, ROW_THRESHOLD)
    print(f"Found {len(h_bands)} horizontal bands (ROW_THRESHOLD={ROW_THRESHOLD})")

    sprites = []  # list of (x0_px, y0_px, x1_px, y1_px)

    for r0, r1 in h_bands:
        if r1 - r0 < MIN_CELLS_TALL:
            continue
        # Column totals within this band
        col_totals = [sum(grid[r][c] for r in range(r0, r1)) for c in range(cols_n)]
        v_bands = split_by_separators(col_totals, COL_THRESHOLD)
        for c0, c1 in v_bands:
            if c1 - c0 < MIN_CELLS_WIDE:
                continue
            sprites.append((c0 * CELL, r0 * CELL, c1 * CELL, r1 * CELL))
            print(f"  sprite: cells col={c0}-{c1-1} row={r0}-{r1-1}  ({c1-c0}×{r1-r0} cells)")

    print(f"\nTotal sprites: {len(sprites)}")

    sprites.sort(key=lambda s: (s[1], s[0]))
    for i, (x0, y0, x1, y1) in enumerate(sprites):
        crop = img.crop((x0, y0, x1, y1))
        fname = f"Generic_Singles_48x48_{i+1}.png"
        crop.save(os.path.join(OUT_DIR, fname))

    print(f"Saved to {OUT_DIR}")

if __name__ == "__main__":
    main()
