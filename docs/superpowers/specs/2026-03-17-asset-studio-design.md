# Asset Studio — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Deliverable:** Standalone HTML file (`asset-studio.html`) saved to Downloads

---

## Overview

A single-file browser tool for creating, generating, and analyzing pixel art assets for the Office Life Sim (Lemon Command Center). Replaces the earlier spec-only playground with three fully functional tools in one app: a character builder, an AI-driven asset generator, and a sprite sheet analyzer. No build step, no server, no external dependencies — open the file in a browser and work.

---

## Architecture

**Single HTML file.** All CSS and JS inline. No CDN dependencies. Saves API keys to `localStorage`.

**State:** One global `state` object. Every control writes to it; every render reads from it. No reactive framework.

**API calls:**
- Claude: `fetch` to `https://api.anthropic.com/v1/messages` with user's API key (header: `x-api-key`)
- Image gen: `fetch` to a configurable endpoint with user's image gen API key

**Themes:** Dark (default) and Warm Sand (muted taupes, no pure white). CSS custom properties on `:root` swapped by toggling a class on `<body>`. Toggle pill lives in the topbar, reachable from every tab.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Office Life Sim — Asset Studio   ● Claude  ● ImgGen  ☀/🌙 │  ← topbar
├──────────────────────────────────────────────────────┤
│ [Character Builder] [Asset Generator] [Sheet Analyzer] [⚙ Settings] │  ← tabs
├──────────────────────────────────────────────────────┤
│                                                      │
│              tab content (full viewport)             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

The topbar always shows:
- App name
- Two API status dots (green = connected, red = not connected)
- Theme toggle pill (☀️ / 🌙)

---

## Tab 1 — Character Builder

Three sub-tabs. State persists when switching between them.

### Sub-tab A: Parts Assembler

**Layout:** Left panel (parts library) | Center (character preview) | Right (frame strip + animation preview)

**Left panel — parts library:**
- Body type: 4 options (pixel art sprites drawn as JS color arrays, no external assets)
- Skin tone: 6 color swatches
- Hair style: 6 options
- Hair color: 6 swatches
- Outfit: 5 options
- Outfit color: 6 swatches
- Accessories: 4 toggleable items (glasses, bag, headphones, hat)

Each part is a 32×32 pixel array defined in JS and layered onto a canvas. Selection highlights chip with accent border + background.

**Center panel:**
- Main canvas: 128px display (32px native at 4× scale), `image-rendering: pixelated`
- Direction strip: ↑ ↓ ← → buttons — switches which direction's frame is shown
- Note: "South-facing · 32px native · 4× display"
- Action buttons: Export PNG | Copy Sheet | → AI Generate (exports the assembled canvas as a base64 PNG, places it in the AI Generate sub-tab's reference image upload slot, and pre-fills the description field with "assembled character from parts assembler", then switches to the AI Generate sub-tab)

**Right panel:**
- Frame strip: 4 direction groups × 4 frame columns = 16 cells. Click any cell to jump to that frame.
- Live animation preview: 44×44px canvas cycling through frames
- FPS slider: 4–24 fps

---

### Sub-tab B: Pixel Editor

**Layout:** Left toolbar | Center canvas grid | Right color palette + frame manager

**Center canvas:**
- 32×32 grid at 14px per cell (~448px work area)
- Each click/drag paints the current color
- Grid lines toggle

**Left toolbar:**
- Pencil (default)
- Eraser
- Flood fill
- Eyedropper (click to sample)
- Undo / Redo (Cmd+Z / Cmd+Shift+Z)

**Right panel:**
- 16 palette swatches + custom color picker input
- Frame manager: same 4×4 grid as Parts Assembler — shows all 16 frames as thumbnails, click to edit

**Export:** `canvas.toDataURL('image/png')` → triggers browser download of the full sprite sheet with all 16 frames packed.

---

### Sub-tab C: AI Generate

**Layout:** Left config | Center (enhanced prompt + result) | Right (variations + history)

**Left config:**
- Description textarea (free text)
- Reference image upload (optional — carries into Claude prompt as base64 and into image gen as reference)
- Grid size: 2×2 / 3×3 / 4×4 / 5×5 / 6×6
- Animation actions: checkboxes — Idle, Walk, Run, Attack, Cast, Jump, Dance, Death + custom field
- Art style: Pixel Art / Chibi / Stardew-warm / Retro 8-bit
- Two buttons: **✦ Enhance** (calls Claude) | **▶ Generate** (calls image gen API)

**Center:**
- Step indicator: `1 Configure → 2 Enhance → 3 Generate` (dots light up as steps complete)
- Enhanced prompt box: editable textarea, pre-filled by Claude. User can edit before generating.
- Result slot: shows loading spinner with stage label during generation ("Enhancing prompt with Claude… / Generating image… / ~15s remaining"), then the generated PNG
- Action buttons below result: Download PNG | Remove BG | Add to Sheet (disabled until result exists)

**Right:**
- Variations: 2×2 grid of 4 variation thumbs. "V1" selected by default. "+ More" cell triggers 4 new variations. **Generation mechanism:** 4 parallel image gen API calls using the same enhanced prompt but with a different random seed appended to each ("Variation 1 of 4, unique seed: [random int]"). No single-call grid approach.
- Tweaks: list of preset modifier rows ("Darker tones → regen", "Stronger shadow → regen", "Warmer palette → regen", "Larger footprint → regen") + custom text input. Clicking a tweak appends text to the description and re-triggers generation.
- History: scrollable list of past generations — thumbnail + name + time-ago label. Click to restore. **Persisted to `localStorage` (max 20 items), same as Asset Generator history.**

**Claude prompt template for character generation:**
```
You are a pixel art asset director for a top-down oblique office life sim
(Stardew Valley aesthetic). The game uses square tiles (~65° camera), NOT
true isometric projection.

[GAME CONTEXT from Settings]

User's character description: [description]
[If reference image: "Use this as visual reference: [base64]"]

Generate a detailed image generation prompt for:
- Sprite sheet: [grid]×[grid] grid = [total] frames
- Row layout: one row per animation ([actions list])
- Style: [art style], 3-step shading, clean outlines, no dithering
- Palette: [palette from game context]
- Background: transparent

Output ONLY the enhanced prompt text, nothing else.
```

---

## Tab 2 — Asset Generator

**Layout:** Left config | Center (step indicator + prompt + result) | Right (variations + tweaks + history)

**Left config:**
- Asset type: Furniture | Floor Tile | Prop (segmented control)
- Description textarea
- Reference image upload (optional)
- Palette: Warm / Cool / Earthy / Vivid
- Shadow: Subtle / Medium / None
- Projection note (always shows "✓ Top-down Oblique — matches your game" — not user-configurable, locked to oblique)
- **✦ Enhance** | **▶ Generate** buttons

**Center:**
- Step indicator: Configure → Enhance → Generate
- Enhanced prompt box (editable, populated by Claude)
- Result slot with loading state (spinner + "Generating image… / ~15s remaining")
- Download PNG | Remove BG | Add to Sheet (disabled until result)

**Right:**
- Variations: 2×2 grid of 4 variation thumbs + "+ More" cell. **Generation mechanism:** 4 parallel image gen API calls with the same enhanced prompt, each with a different random seed appended.
- Tweaks: "Darker tones → regen", "Stronger shadow → regen", "Warmer palette → regen", "Larger footprint → regen" + custom input
- History: thumbnail + name + time-ago list (persists in `localStorage`, max 20 items)

**Claude prompt template for furniture:**
```
You are a pixel art asset director for a top-down oblique office life sim.

[GAME CONTEXT from Settings]

Generate a detailed image generation prompt for a single [asset type] asset:
Description: [user description]
Projection: top-down oblique (south-facing front view, ~65° camera,
            no isometric diamond tiles, no side faces)
Tile footprint: 32×32px standard, 32×64px for tall objects
Shadow: [shadow setting] — cast directly below and slightly south
Palette: [palette]
Style: 3-step shading, clean outlines, no dithering, transparent background

Output ONLY the enhanced prompt text.
```

---

## Tab 3 — Sheet Analyzer

**Layout:** Left (upload + grid controls) | Center (sheet preview) | Right (results)

**Left panel:**
- Drop zone: drag-and-drop or click to upload PNG/JPG/WebP up to 10MB. Previews thumbnail on upload.
- Grid overlay controls (sliders, update overlay live):
  - Columns: 1–16
  - Rows: 1–16
  - Frame W: 8–128px
  - Frame H: 8–128px
- **✦ Analyze with Claude** button (primary, bottom of panel)

**Center panel:**
- Sheet preview canvas with interactive grid overlay (rgba lines at configurable intervals)
- Row labels along left edge (Row 0, Row 1, etc.) using accent color at low opacity
- Status line below: "Zoom: 1× · WxHpx sheet · C×R grid → FxFpx frames"

**Right panel:**
- Empty state until analysis runs: icon + "Upload a sheet and click Analyze with Claude to see projection, frame size, and animation breakdown."
- After analysis, result cards:
  - **Projection** — detected type + compatibility badge (✓ Match / ⚠ Incompatible)
  - **Frame Size** — e.g. "32 × 32 px"
  - **Layout** — e.g. "4 col × 4 row = 16 frames"
  - **Animation Rows** — color-coded row list with Claude's best guess at animation names
  - **Notes** — any compatibility warnings or suggestions
- **⬇ Generate Matching Prompt** button — disabled until analysis completes. Calls Claude again to produce a game-specific generation prompt matching the detected style/projection.

**Claude prompt template for analysis:**
```
Analyze this sprite sheet image for use in a pixel art game.

Identify and respond with exactly this JSON structure:
{
  "projection": "top-down-oblique|isometric|side-scrolling|other",
  "projection_confidence": "high|medium|low",
  "compatible_with_oblique_game": true|false,
  "frame_width_px": number,
  "frame_height_px": number,
  "columns": number,
  "rows": number,
  "total_frames": number,
  "animation_rows": [
    {"row": 0, "name": "Walk South", "confidence": "high"}
  ],
  "style_notes": "brief description of art style and palette",
  "compatibility_notes": "any issues or recommendations"
}
```

---

## Tab 4 — Settings

**Layout:** Two columns

**Left column — API keys:**
- Claude API key (password input + Test button + status dot/label)
- Image generation service selector: Stability AI / OpenAI / Replicate / Custom
- Image gen API key (password input + Test button + status dot/label)
- Endpoint URL (text input, pre-filled per service, editable for Custom)

**Right column — context + storage:**
- Game Context block: editable textarea, pre-filled with:
  ```
  Game: Office Life Sim (top-down oblique, NOT isometric)
  Projection: square tiles, ~65° camera, south-facing furniture
  Tile size: 32×32px characters, 16×16px floor tiles
  Style: modern pixel art, warm palette, 3-step shading
  Palette: off-whites, warm grays, lemon yellow, teal, coral
  No dithering, clean outlines, distinct silhouettes
  ```
- Reset to Defaults button
- Storage note: "Keys stored in localStorage. Never sent anywhere except configured endpoints."
- Clear All Keys button (destructive, red-tinted)

**Test connection flow:** Clicking Test sends a minimal API call (Claude: 1-token completion; Image gen: smallest possible request). Shows "Connected ✓" or error message inline.

---

## State Object

```javascript
const state = {
  theme: 'dark',               // 'dark' | 'warm-sand'
  activeTab: 'character',      // 'character' | 'asset' | 'analyzer' | 'settings'

  // Character Builder
  character: {
    subTab: 'assembler',       // 'assembler' | 'editor' | 'ai'
    parts: { body: 0, skin: 1, hair: 1, hairColor: 2, outfit: 0, outfitColor: 1, accessories: [] },
    // Parts Assembler renders on-the-fly from `parts` state — no stored frames.
    // Layering order (bottom to top): body base, outfit, hair, accessories.
    // Pixel Editor stores frames as explicit 32×32 pixel arrays (one per cell in the 4×4 grid).
    // The two sub-tabs are independent: Assembler → "→ AI Generate" exports a PNG, it does NOT
    // pre-populate the Pixel Editor frames.
    frames: [],                // 16 frames as 32×32 color arrays — Pixel Editor only
    activeFrame: 0,
    direction: 'south',
    fps: 12,
    // AI Generate sub-tab has its own isolated state (separate from Asset Generator)
    ai: {
      description: '',
      referenceImage: null,    // base64 PNG — populated by "→ AI Generate" from Assembler, or manual upload
      gridSize: 4,             // 2–6
      actions: ['idle', 'walk'],
      artStyle: 'pixel-art',
      enhancedPrompt: '',
      result: null,            // base64 PNG from image gen
      variations: [],          // array of base64 PNGs (max 4)
      history: [],             // persisted to localStorage, max 20
    },
  },

  // Asset Generator
  asset: {
    type: 'furniture',
    description: '',
    referenceImage: null,      // base64
    palette: 'warm',
    shadow: 'subtle',
    enhancedPrompt: '',
    result: null,              // base64 PNG
    variations: [],
    history: [],               // persisted to localStorage
  },

  // Sheet Analyzer
  analyzer: {
    sheet: null,               // base64 of uploaded image
    gridCols: 4,
    gridRows: 4,
    frameW: 32,
    frameH: 32,
    analysisResult: null,
    matchingPrompt: '',
  },

  // Settings
  settings: {
    claudeKey: '',
    imageGenService: 'stability',
    imageGenKey: '',
    imageGenEndpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
    gameContext: '...',        // default block
  }
};
```

All `settings.*` fields are synced to/from `localStorage` on change and on page load.

---

## Loading & Error States

**Generation loading:** Spinner animation + two-line label ("Generating image… / ~15s remaining"). Action buttons disabled with 0.4 opacity.

**Claude loading:** Inline "Thinking…" label replaces button text during the call.

**API errors:** Inline red-tinted error card below the relevant field or result slot. Message shows HTTP status + truncated API error message. Never a full-page error.

**Empty states:** Every panel that waits for user action has an explicit empty state (icon + instructional text). No blank white boxes.

---

## Export

- **Character sheet:** `canvas.toDataURL('image/png')` → `<a download="sprite_name_walk.png">` trigger
- **Single asset:** Same pattern → `<a download="asset_name.png">`
- **Analysis text:** `navigator.clipboard.writeText(JSON.stringify(result, null, 2))`
- **Matching prompt:** `navigator.clipboard.writeText(matchingPrompt)` with "Copied!" feedback

---

## Image Gen API Request Format

The tool targets **Stability AI** as the primary implementation. The Custom option lets users point at any endpoint.

**Stability AI (default):**
```
POST {endpoint}
Headers: Authorization: Bearer {key}, Accept: image/png
Form-data: prompt, output_format=png, seed={random int 0–2147483647}
Response: raw PNG bytes → convert to base64 for display
```

**Seed for variations:** Each of the 4 variation calls appends `seed={unique random int}` to the form-data. This produces deterministic variation from a shared prompt.

**OpenAI / Replicate / Custom:** When the user selects these services, the endpoint URL field is editable and the request body is sent as JSON `{ "prompt": "...", "seed": N }`. The implementer maps to the specific service's documented schema. The tool is not responsible for every service's exact field names — the configurable endpoint + editable URL covers the custom case.

---

## Remove Background

**Implementation:** Canvas-based color-threshold removal. After the image is drawn to a canvas, sample the corner pixel (assumed to be background) and flood-fill outward replacing any pixel within a configurable tolerance (default: color distance < 30) with transparent. This is entirely client-side — no additional API call, no third-party service. A tolerance slider appears in the Remove BG button's popover (range 10–60, default 30).

---

## Out of Scope

- No animation timeline editor (beyond FPS preview)
- No multi-layer pixel editor (single flat layer)
- No cloud save / accounts
- No batch generation
- No direct integration with the game codebase
- No true isometric projection support (tool is locked to oblique)
