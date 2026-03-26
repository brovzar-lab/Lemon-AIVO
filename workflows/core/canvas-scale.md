---
description: Make the office canvas responsive — fills center column edge-to-edge, scales to fit with no dead space or cropping. Runs full engineer + designer audit pipeline.
---

# /canvas-scale — Responsive Canvas Audit & Fix

$ARGUMENTS

---

## What This Does

Makes the pixel-art office canvas fill the available center column at **any window size**:
- Larger screen → canvas grows to fill
- Smaller screen → canvas shrinks to fit
- Zero dead space (brown background), zero cropping
- Scale-to-fit (Option A: full office visible, no crop, no gaps)

---

## PHASE 1 — Audit (Always run first)

### Step 1: Read current canvas sizing approach

// turbo
```bash
grep -n "computeAutoFitZoom\|isAutoFitZoom\|canvas.width\|canvas.height\|getBoundingClientRect\|zoom" src/engine/gameLoop.ts | head -60
```

### Step 2: Read the content bounding box

// turbo
```bash
grep -n "GRID_COLS\|GRID_ROWS\|CONTENT_COLS\|CONTENT_ROWS\|PADDING_TILES\|TILE_SIZE" src/engine/officeLayout.ts src/engine/camera.ts src/engine/types.ts 2>/dev/null
```

### Step 3: Check CSS container — look for padding, fixed sizes, overflow

// turbo
```bash
grep -n "canvas-wrap\|overflow\|flex.*1\|min-height\|padding" src/pixelDesignSystem.css | head -20
```

### Step 4: Check App.tsx center column container

// turbo
```bash
grep -n "flex.*1\|overflow\|position.*relative\|OfficeCanvas" src/App.tsx
```

---

## PHASE 2 — Design System Audit (Engineer + Designer checks)

### Step 5: Run ui-ux-pro-max audit for canvas/game UI patterns

```bash
python3 .shared/ui-ux-pro-max/scripts/search.py "pixel art game canvas responsive scaling dashboard" --design-system -p "LEMON-AIVO"
```

```bash
python3 .shared/ui-ux-pro-max/scripts/search.py "canvas resize responsive fill" --domain ux
```

```bash
python3 .shared/ui-ux-pro-max/scripts/search.py "performance animation canvas resize" --domain react
```

---

## PHASE 3 — Apply Fixes

Apply ALL of the following checks/fixes. Mark each ✅ or ❌:

### Engineer Checklist

- [ ] **`isAutoFitZoom` starts `true`** — office fills canvas on load, not at fixed `zoom: 2`
- [ ] **Per-frame auto-fit** — zoom reapplied every frame when `isAutoFitZoom=true`, so shrinking window instantly scales down (no cropping lag)
- [ ] **Auto-fit disabled only on user zoom** — `zoomState.phase === 'input'` (wheel/pinch only), NOT on `startAnimatedZoom` (which sets phase `'snapping'`, not `'input'`)
- [ ] **Content bounding box** — `computeAutoFitZoom` uses actual room content dimensions (not full tile map including blank rows), + 2-tile padding margin
- [ ] **HiDPI** — `canvas.width = rect.width * dpr`, `canvas.height = rect.height * dpr` on every resize
- [ ] **No fixed canvas px size** — canvas CSS is `width: 100%; height: 100%; display: block`
- [ ] **Container has no padding** — `.canvas-wrap` or center column container has `padding: 0`, `overflow: hidden`
- [ ] **ResizeObserver / getBoundingClientRect pattern** — resize detected every frame via `rect = canvas.getBoundingClientRect()` comparison
- [ ] **minZoom = auto-fit zoom** — user can't zoom out past the fit level (no showing blank space around map)
- [ ] **Editor mode re-fits** — when entering editor mode, zoom resets to auto-fit so full map visible

### Designer Checklist

- [ ] **No visible brown/dark canvas background** — map tiles fill entire canvas edge to edge at auto-fit zoom
- [ ] **Panel gaps = 0** — no space between left panel edge, canvas left edge; same right side
- [ ] **Room labels scale correctly** — zoom-level-dependent overlays (room name chips, agent status) stay positioned correctly at all zoom levels
- [ ] **Zoom controls still work** — user can zoom in beyond auto-fit and zoom out back to auto-fit
- [ ] **"Fit to Screen" button resets correctly** — triggers `isAutoFitZoom = true` and immediately re-ticks the per-frame zoom
- [ ] **Responsive breakpoints tested**: 1440px, 1280px, 1024px, 768px (panels collapse or stack)
- [ ] **No layout jank on resize** — smooth continuous scaling, no "pop" or sudden jump

---

## PHASE 4 — Verify at Breakpoints

### Step 6: Check for TypeScript errors after changes

// turbo
```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

### Step 7: Check the running dev server output

// turbo
```bash
grep -n "isAutoFitZoom\|computeAutoFitZoom\|CONTENT_COLS\|CONTENT_ROWS\|PADDING_TILES" src/engine/gameLoop.ts src/engine/camera.ts
```

### Step 8: Visual breakpoint audit (describe what to check in browser)

Open browser DevTools → Device Toolbar and verify at:
- **1440px wide**: Office fills center, small breathing margin
- **1280px wide**: Office still fills, slightly smaller zoom
- **1024px wide**: Office visible and filling, no dead space
- **768px wide**: Office scales down, panels may stack — no cropping

---

## PHASE 5 — Commit & Deploy

### Step 9: Stage and commit

// turbo
```bash
cd /Users/quantumcode/CODE/LEMON-AIVO && git add -A && git commit -m "feat: responsive canvas auto-fit — fills center column at all viewport sizes"
```

### Step 10: Build and deploy

```bash
cd /Users/quantumcode/CODE/LEMON-AIVO && npx vite build && firebase deploy
```

---

## What Gets Fixed End-to-End

| Issue | Fix Location | Mechanism |
|-------|-------------|-----------|
| Dead space around canvas | `gameLoop.ts` | `isAutoFitZoom = true` on startup |
| Cropping on resize | `gameLoop.ts` | Per-frame zoom = `computeAutoFitZoom` |
| Auto-fit disabled by animation | `gameLoop.ts` | Only `phase === 'input'` disables auto-fit |
| Blank tile rows adding dead space | `camera.ts` | Content bounding box (not full map) |
| Canvas background visible | CSS + zoom math | minZoom = auto-fit = no over-zoom-out |
| Fixed-size canvas at startup | `camera.ts` | `createCamera()` zoom overridden first frame |

---

## Caution

- If the user has manually zoomed, `isAutoFitZoom = false` — to re-enable, trigger `window.__boiler_reset_autofit = true` or reload
- This only applies to the **center canvas** — left panel and right panel are React-controlled and manage their own widths
- Do NOT use `startAnimatedZoom` for auto-fit resize — it sets `phase = 'snapping'` which previously broke the `isAutoFitZoom` flag
