# Asset Studio Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `~/Downloads/asset-studio.html` — a standalone single-file browser tool for creating, generating, and analyzing pixel art assets for the Office Life Sim.

**Architecture:** One HTML file, all CSS and JS inline, no external dependencies. Single global `state` object drives all rendering. Four tabs (Character Builder, Asset Generator, Sheet Analyzer, Settings) with localStorage persistence for API keys and history.

**Tech Stack:** Vanilla HTML/CSS/JS, Canvas 2D API, Claude API (`/v1/messages` with vision), Stability AI image gen API (configurable endpoint), localStorage.

---

## File Map

| File | Purpose |
|------|---------|
| `~/Downloads/asset-studio.html` | Single deliverable — all HTML, CSS, JS inline |

**Internal JS sections (in order):**
1. `STATE` — global state object
2. `THEME` — CSS var swap + toggle
3. `SETTINGS` — localStorage sync, API key inputs, status dots
4. `API` — `callClaude()`, `callImageGen()`, status dot updater
5. `PARTS_DATA` — pixel art part arrays (body types, hair, outfits, accessories)
6. `ASSEMBLER` — canvas compositing, direction strip, animation preview
7. `PIXEL_EDITOR` — 32×32 grid, tools, undo/redo, frame manager
8. `CHAR_AI` — Character Builder AI Generate sub-tab
9. `ASSET_GEN` — Asset Generator tab
10. `ANALYZER` — Sheet Analyzer tab
11. `REMOVE_BG` — canvas flood-fill background removal
12. `HISTORY` — localStorage history helpers (shared)
13. `INIT` — page load, route restoration

---

## Task 1: HTML Shell + Theme System

**Files:**
- Create: `~/Downloads/asset-studio.html`

- [ ] **Step 1: Create the file with DOCTYPE, head, and CSS custom properties**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Office Life Sim — Asset Studio</title>
<style>
/* ── THEME TOKENS ── */
:root { --transition: background 0.2s, color 0.2s; }

body.dark {
  --bg0: #1a1a1f;
  --bg1: #22222a;
  --bg2: #2a2a35;
  --surface: #32323e;
  --border: #3e3e4e;
  --text: #e8e6f0;
  --muted: #7a788a;
  --accent: #f5c542;
  --accent-dim: rgba(245,197,66,0.15);
  --red: #e05c5c;
  --green: #5cbf7a;
}

body.warm-sand {
  --bg0: #dedad4;
  --bg1: #e8e4de;
  --bg2: #ede9e3;
  --surface: #f2efe9;
  --border: #c8c4bc;
  --text: #2e2b26;
  --muted: #8a857c;
  --accent: #c07a1e;
  --accent-dim: rgba(192,122,30,0.12);
  --red: #c0392b;
  --green: #2e7d4f;
}

/* ── RESET ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  background: var(--bg0);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: var(--transition);
}

/* ── TOPBAR ── */
#topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 44px;
  background: var(--bg1);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
#topbar .app-name {
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.01em;
  margin-right: auto;
}
.status-dot {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}
.status-dot .dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--red);
  transition: background 0.3s;
}
.status-dot .dot.connected { background: var(--green); }

/* Theme toggle pill */
#theme-toggle {
  display: flex;
  align-items: center;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px;
  gap: 2px;
  cursor: pointer;
}
#theme-toggle button {
  background: none;
  border: none;
  padding: 3px 8px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
#theme-toggle button.active {
  background: var(--accent);
  color: var(--bg0);
}

/* ── MAIN TABS ── */
#tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 16px;
  height: 40px;
  background: var(--bg1);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.tab-btn {
  background: none;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tab-btn:hover { background: var(--bg2); color: var(--text); }
.tab-btn.active { background: var(--accent-dim); color: var(--accent); font-weight: 500; }

/* ── TAB CONTENT ── */
#content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.tab-panel {
  display: none;
  height: 100%;
  overflow: auto;
}
.tab-panel.active { display: flex; }

/* ── SHARED LAYOUT UTILITIES ── */
.panel { background: var(--bg1); border-right: 1px solid var(--border); }
.panel-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 12px 14px 6px;
}
.section { padding: 10px 14px; border-bottom: 1px solid var(--border); }
input, textarea, select {
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  width: 100%;
  outline: none;
}
input:focus, textarea:focus, select:focus { border-color: var(--accent); }
button.btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
button.btn:hover { background: var(--bg2); }
button.btn-accent {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg0);
  font-weight: 600;
}
button.btn-accent:hover { opacity: 0.88; }
button.btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
</head>
<body class="dark">
```

- [ ] **Step 2: Add the topbar HTML**

```html
<div id="topbar">
  <span class="app-name">Office Life Sim — Asset Studio</span>
  <div class="status-dot">
    <div class="dot" id="dot-claude"></div> Claude
  </div>
  <div class="status-dot">
    <div class="dot" id="dot-imggen"></div> ImgGen
  </div>
  <div id="theme-toggle">
    <button id="btn-dark" class="active" onclick="setTheme('dark')">🌙</button>
    <button id="btn-warm" onclick="setTheme('warm-sand')">☀️</button>
  </div>
</div>
```

- [ ] **Step 3: Add the tab bar and content panels**

```html
<div id="tab-bar">
  <button class="tab-btn active" onclick="switchTab('character')">Character Builder</button>
  <button class="tab-btn" onclick="switchTab('asset')">Asset Generator</button>
  <button class="tab-btn" onclick="switchTab('analyzer')">Sheet Analyzer</button>
  <button class="tab-btn" onclick="switchTab('settings')">⚙ Settings</button>
</div>

<div id="content">
  <div id="tab-character" class="tab-panel active"><!-- Task 3 --></div>
  <div id="tab-asset"     class="tab-panel"><!-- Task 7 --></div>
  <div id="tab-analyzer"  class="tab-panel"><!-- Task 8 --></div>
  <div id="tab-settings"  class="tab-panel"><!-- Task 2 --></div>
</div>
```

- [ ] **Step 4: Add state object and theme/tab JS**

```html
<script>
// ── STATE ──
const state = {
  theme: localStorage.getItem('theme') || 'dark',
  activeTab: 'character',
  character: {
    subTab: 'assembler',
    parts: { body: 0, skin: 1, hair: 1, hairColor: 2, outfit: 0, outfitColor: 1, accessories: [] },
    frames: Array.from({length: 16}, () => Array.from({length: 32}, () => new Array(32).fill(null))),
    activeFrame: 0, direction: 'south', fps: 12,
    ai: { description: '', referenceImage: null, gridSize: 4, actions: ['idle','walk'],
          artStyle: 'pixel-art', enhancedPrompt: '', result: null, variations: [], history: [] },
  },
  asset: { type: 'furniture', description: '', referenceImage: null, palette: 'warm',
           shadow: 'subtle', enhancedPrompt: '', result: null, variations: [], history: [] },
  analyzer: { sheet: null, gridCols: 4, gridRows: 4, frameW: 32, frameH: 32,
               analysisResult: null, matchingPrompt: '' },
  settings: {
    claudeKey: localStorage.getItem('claudeKey') || '',
    imageGenService: localStorage.getItem('imageGenService') || 'stability',
    imageGenKey: localStorage.getItem('imageGenKey') || '',
    imageGenEndpoint: localStorage.getItem('imageGenEndpoint') ||
      'https://api.stability.ai/v2beta/stable-image/generate/core',
    gameContext: localStorage.getItem('gameContext') ||
`Game: Office Life Sim (top-down oblique, NOT isometric)
Projection: square tiles, ~65° camera, south-facing furniture
Tile size: 32×32px characters, 16×16px floor tiles
Style: modern pixel art, warm palette, 3-step shading
Palette: off-whites, warm grays, lemon yellow, teal, coral
No dithering, clean outlines, distinct silhouettes`,
  },
};

// ── THEME ──
function setTheme(t) {
  state.theme = t;
  document.body.className = t;
  document.getElementById('btn-dark').classList.toggle('active', t === 'dark');
  document.getElementById('btn-warm').classList.toggle('active', t === 'warm-sand');
  localStorage.setItem('theme', t);
}
setTheme(state.theme);

// ── TAB SWITCHING ──
function switchTab(name) {
  state.activeTab = name;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.getAttribute('onclick')?.includes(name)) b.classList.add('active');
  });
}
</script>
</body>
</html>
```

- [ ] **Step 5: Open in browser and verify**

```bash
open ~/Downloads/asset-studio.html
```

Expected: Dark page with topbar (app name, two red dots, moon/sun toggle), four tab buttons. Clicking theme toggle switches to warm-sand muted tones. Clicking tabs switches active highlight. No console errors.

- [ ] **Step 6: Commit**

```bash
git add ~/Downloads/asset-studio.html 2>/dev/null || true
# file lives in Downloads — no git needed, just verify it opens correctly
```

---

## Task 2: Settings Tab

**Files:**
- Modify: `~/Downloads/asset-studio.html` — replace `<!-- Task 2 -->` in `#tab-settings`

- [ ] **Step 1: Add Settings tab CSS**

Add inside `<style>`:
```css
/* ── SETTINGS ── */
#tab-settings { padding: 24px; gap: 24px; align-items: flex-start; }
.settings-col { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 420px; }
.settings-card {
  background: var(--bg1);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.settings-card h3 { font-size: 13px; font-weight: 600; color: var(--text); }
.key-row { display: flex; gap: 8px; }
.key-row input { flex: 1; font-family: monospace; font-size: 12px; }
.status-label { font-size: 12px; color: var(--muted); min-height: 18px; }
.status-label.ok { color: var(--green); }
.status-label.err { color: var(--red); }
.storage-note { font-size: 11px; color: var(--muted); line-height: 1.5; }
button.btn-danger {
  background: rgba(224,92,92,0.1);
  border-color: var(--red);
  color: var(--red);
}
button.btn-danger:hover { background: rgba(224,92,92,0.2); }
```

- [ ] **Step 2: Add Settings HTML inside `#tab-settings`**

```html
<!-- LEFT: API Keys -->
<div class="settings-col">
  <div class="settings-card">
    <h3>Claude API Key</h3>
    <div class="key-row">
      <input type="password" id="claude-key" placeholder="sk-ant-…" oninput="saveSetting('claudeKey', this.value)">
      <button class="btn" onclick="testClaude()">Test</button>
    </div>
    <div class="status-label" id="claude-status"></div>
  </div>

  <div class="settings-card">
    <h3>Image Generation</h3>
    <label style="font-size:12px;color:var(--muted)">Service</label>
    <select id="imggen-service" onchange="onServiceChange(this.value)">
      <option value="stability">Stability AI</option>
      <option value="openai">OpenAI</option>
      <option value="replicate">Replicate</option>
      <option value="custom">Custom</option>
    </select>
    <div class="key-row">
      <input type="password" id="imggen-key" placeholder="API key" oninput="saveSetting('imageGenKey', this.value)">
      <button class="btn" onclick="testImgGen()">Test</button>
    </div>
    <div class="status-label" id="imggen-status"></div>
    <label style="font-size:12px;color:var(--muted)">Endpoint URL</label>
    <input type="text" id="imggen-endpoint" oninput="saveSetting('imageGenEndpoint', this.value)">
  </div>
</div>

<!-- RIGHT: Context + Storage -->
<div class="settings-col">
  <div class="settings-card">
    <h3>Game Context</h3>
    <textarea id="game-context" rows="8" oninput="saveSetting('gameContext', this.value)"
      style="resize:vertical;font-size:12px;font-family:monospace"></textarea>
    <button class="btn" onclick="resetGameContext()">Reset to Defaults</button>
  </div>

  <div class="settings-card">
    <h3>Storage</h3>
    <p class="storage-note">API keys are stored in localStorage and never sent anywhere except the configured endpoints.</p>
    <button class="btn btn-danger" onclick="clearAllKeys()">Clear All Keys</button>
  </div>
</div>
```

- [ ] **Step 3: Add Settings JS — below the tab-switching JS block**

```javascript
// ── SETTINGS ──
const SERVICE_ENDPOINTS = {
  stability: 'https://api.stability.ai/v2beta/stable-image/generate/core',
  openai: 'https://api.openai.com/v1/images/generations',
  replicate: 'https://api.replicate.com/v1/predictions',
  custom: '',
};

function initSettings() {
  document.getElementById('claude-key').value = state.settings.claudeKey;
  document.getElementById('imggen-key').value = state.settings.imageGenKey;
  document.getElementById('imggen-service').value = state.settings.imageGenService;
  document.getElementById('imggen-endpoint').value = state.settings.imageGenEndpoint;
  document.getElementById('game-context').value = state.settings.gameContext;
  updateStatusDots();
}

function saveSetting(key, value) {
  state.settings[key] = value;
  localStorage.setItem(key, value);
  updateStatusDots();
}

function onServiceChange(service) {
  saveSetting('imageGenService', service);
  const ep = SERVICE_ENDPOINTS[service] || '';
  document.getElementById('imggen-endpoint').value = ep;
  saveSetting('imageGenEndpoint', ep);
}

function updateStatusDots() {
  document.getElementById('dot-claude').classList.toggle('connected', !!state.settings.claudeKey);
  document.getElementById('dot-imggen').classList.toggle('connected', !!state.settings.imageGenKey);
}

function resetGameContext() {
  const def = `Game: Office Life Sim (top-down oblique, NOT isometric)
Projection: square tiles, ~65° camera, south-facing furniture
Tile size: 32×32px characters, 16×16px floor tiles
Style: modern pixel art, warm palette, 3-step shading
Palette: off-whites, warm grays, lemon yellow, teal, coral
No dithering, clean outlines, distinct silhouettes`;
  state.settings.gameContext = def;
  localStorage.setItem('gameContext', def);
  document.getElementById('game-context').value = def;
}

function clearAllKeys() {
  if (!confirm('Clear all stored API keys?')) return;
  ['claudeKey','imageGenKey'].forEach(k => {
    state.settings[k] = '';
    localStorage.removeItem(k);
  });
  document.getElementById('claude-key').value = '';
  document.getElementById('imggen-key').value = '';
  updateStatusDots();
  document.getElementById('claude-status').textContent = '';
  document.getElementById('imggen-status').textContent = '';
}

async function testClaude() {
  const el = document.getElementById('claude-status');
  el.textContent = 'Testing…'; el.className = 'status-label';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': state.settings.claudeKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }] }),
    });
    if (r.ok || r.status === 400) { // 400 = valid key but bad request = key works
      el.textContent = 'Connected ✓'; el.className = 'status-label ok';
      document.getElementById('dot-claude').classList.add('connected');
    } else {
      const j = await r.json();
      el.textContent = `Error ${r.status}: ${j.error?.message?.slice(0,60) || 'Unknown'}`;
      el.className = 'status-label err';
    }
  } catch(e) { el.textContent = 'Network error'; el.className = 'status-label err'; }
}

async function testImgGen() {
  const el = document.getElementById('imggen-status');
  el.textContent = 'Key saved ✓ (live test uses credits)';
  el.className = 'status-label ok';
}
```

- [ ] **Step 4: Wire up init call — replace any existing DOMContentLoaded listener at bottom of script block with this one**

> **Note:** Each task replaces the DOMContentLoaded listener with a cumulative version. Task 10 Step 1 is the final authoritative listener. Always replace (don't add) to avoid double-initialization.

```javascript
document.addEventListener('DOMContentLoaded', () => {
  initSettings();
});
```

- [ ] **Step 5: Open in browser → click ⚙ Settings tab**

Expected: Two-column settings layout. Entering a Claude key turns the topbar dot green. Test button shows "Connected ✓" or error message. Service dropdown changes endpoint URL. Game context textarea is pre-filled. Clear All Keys prompts before clearing.

---

## Task 3: API Utilities

**Files:**
- Modify: `~/Downloads/asset-studio.html` — add API utility functions to the script block

- [ ] **Step 1: Add `callClaude()` utility**

```javascript
// ── API UTILITIES ──
async function callClaude(messages, { maxTokens = 1024, onThinking } = {}) {
  if (!state.settings.claudeKey) throw new Error('No Claude API key. Set it in Settings.');
  if (onThinking) onThinking(true);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': state.settings.claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Claude ${r.status}: ${j.error?.message || r.statusText}`);
    }
    const j = await r.json();
    return j.content[0].text;
  } finally {
    if (onThinking) onThinking(false);
  }
}
```

- [ ] **Step 2: Add `callImageGen()` utility**

```javascript
// Safe base64 encoder for large ArrayBuffers (avoids spread stack overflow on >65KB)
function bufToBase64(buf) {
  let b = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 8192) {
    b += String.fromCharCode(...u.subarray(i, i + 8192));
  }
  return btoa(b);
}

async function callImageGen(prompt, seed) {
  const { imageGenService, imageGenKey, imageGenEndpoint } = state.settings;
  if (!imageGenKey) throw new Error('No image gen API key. Set it in Settings.');

  if (imageGenService === 'stability') {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('output_format', 'png');
    form.append('seed', String(seed ?? Math.floor(Math.random() * 2147483647)));
    const r = await fetch(imageGenEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${imageGenKey}`, Accept: 'image/png' },
      body: form,
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`ImgGen ${r.status}: ${t.slice(0, 120)}`);
    }
    const buf = await r.arrayBuffer();
    return 'data:image/png;base64,' + bufToBase64(buf);
  } else {
    // OpenAI / Replicate / Custom — JSON body
    const r = await fetch(imageGenEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${imageGenKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, seed: seed ?? Math.floor(Math.random() * 2147483647) }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`ImgGen ${r.status}: ${t.slice(0, 120)}`);
    }
    const j = await r.json();
    // Handle common response shapes
    const url = j.data?.[0]?.url || j.output?.[0] || j.url;
    if (!url) throw new Error('Unexpected image gen response shape');
    const img = await fetch(url);
    const buf = await img.arrayBuffer();
    return 'data:image/png;base64,' + bufToBase64(buf);
  }
}
```

- [ ] **Step 3: Add shared error card helper**

```javascript
function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="error-card">${escHtml(message)}</div>`;
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
```

Add to CSS:
```css
.error-card {
  background: rgba(224,92,92,0.1);
  border: 1px solid var(--red);
  border-radius: 6px;
  padding: 10px 12px;
  color: var(--red);
  font-size: 12px;
  line-height: 1.5;
}
```

- [ ] **Step 4: No browser test needed — utilities are called by later tasks. Confirm no syntax errors by opening file and checking console.**

---

## Task 4: Parts Assembler — Pixel Data + Canvas

**Files:**
- Modify: `~/Downloads/asset-studio.html`

- [ ] **Step 1: Add pixel art part data and compositing helper**

The parts are 32×32 color arrays (`null` = transparent). Define a compact helper plus one complete body sprite for each of the 4 body types. Skin tone, hair color, and outfit color are applied as tint passes over designated regions.

```javascript
// ── PARTS DATA ──
// Color roles:  S=skin  H=hair  O=outfit  L=legs  .=transparent
// Actual colors come from SKIN_TONES / HAIR_COLORS / OUTFIT_COLORS arrays (applied at render time)
// These arrays use role characters; compositing resolves them to hex.

const SKIN_TONES   = ['#fcd5b0','#f4b07a','#e8955a','#c07040','#8b5a35','#5c3520'];
const HAIR_COLORS  = ['#1a1a1a','#5c3a1e','#c07a1e','#e8d060','#a0a0a0','#e84060'];
const OUTFIT_COLORS = ['#4a7fc1','#5cbf7a','#c05050','#8855bb','#c0923a','#555566'];
const LEG_COLORS   = ['#2a2a3e','#3a5030','#503030','#2a3a50','#504020','#404040'];

// Compact row encoder: string of role chars → array of role chars
function parseRows(rows) { return rows.map(r => [...r]); }

// Body 0 — Regular (balanced proportions)
const BODY_SHAPES = [
  parseRows([
    '................................',
    '................................',
    '............SSSSSSSS............',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '................................',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......LLLLLL....LLLLLLLL........',  // gap between legs
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......OOOOOO....OOOOOOOO........',  // shoes
    '......OOOOOO....OOOOOOOO........',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Body 1 — Slim (narrower torso)
  parseRows([
    '................................',
    '................................',
    '.............SSSSSS.............',
    '...........SSSSSSSSSS...........',
    '...........SSSSSSSSSS...........',
    '...........SSSSSSSSSS...........',
    '...........SSSSSSSSSS...........',
    '...........SSSSSSSSSS...........',
    '................................',
    '.........OOOOOOOOOOOOOO.........',
    '.........OOOOOOOOOOOOOO.........',
    '.........OOOOOOOOOOOOOO.........',
    '.........OOOOOOOOOOOOOO.........',
    '.........OOOOOOOOOOOOOO.........',
    '.........OOOOOOOOOOOOOO.........',
    '.......OOOOOOOOOOOOOOOOOO.......',
    '.......OOOOOOOOOOOOOOOOOO.......',
    '.......OOOOOOOOOOOOOOOOOO.......',
    '.......OOOOOOOOOOOOOOOOOO.......',
    '.......LLLLLL....LLLLLLL........',
    '.......LLLLLL....LLLLLLL........',
    '.......LLLLLL....LLLLLLL........',
    '.......LLLLLL....LLLLLLL........',
    '.......LLLLLL....LLLLLLL........',
    '.......LLLLLL....LLLLLLL........',
    '.......LLLLLL....LLLLLLL........',
    '.......OOOOOO....OOOOOOO........',
    '.......OOOOOO....OOOOOOO........',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Body 2 — Round (wider proportions)
  parseRows([
    '................................',
    '................................',
    '..........SSSSSSSSSS............',
    '........SSSSSSSSSSSSSS..........',
    '........SSSSSSSSSSSSSS..........',
    '........SSSSSSSSSSSSSS..........',
    '........SSSSSSSSSSSSSS..........',
    '........SSSSSSSSSSSSSS..........',
    '................................',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '....OOOOOOOOOOOOOOOOOOOOOOOO....',
    '....OOOOOOOOOOOOOOOOOOOOOOOO....',
    '....OOOOOOOOOOOOOOOOOOOOOOOO....',
    '....OOOOOOOOOOOOOOOOOOOOOOOO....',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....LLLLLLLL....LLLLLLLLLL......',
    '....OOOOOOOO....OOOOOOOOOO......',
    '....OOOOOOOO....OOOOOOOOOO......',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Body 3 — Tall (elongated)
  parseRows([
    '................................',
    '............SSSSSSSS............',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '..........SSSSSSSSSSSS..........',
    '................................',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '........OOOOOOOOOOOOOOOO........',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......OOOOOOOOOOOOOOOOOOOO......',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......LLLLLL....LLLLLLLL........',
    '......OOOOOO....OOOOOOOO........',
    '......OOOOOO....OOOOOOOO........',
    '......OOOOOO....OOOOOOOO........',
    '................................',
    '................................',
    '................................',
  ]),
];

// Hair styles — 6 options — drawn on top of head region
// Each is a 32×32 role map using H for hair, . for transparent
const HAIR_SHAPES = [
  // Style 0 — Short
  parseRows([
    '................................',
    '..........HHHHHHHHHH............',
    '.........HHHHHHHHHHHH...........',
    '.........HH..........HH.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Style 1 — Medium
  parseRows([
    '................................',
    '..........HHHHHHHHHH............',
    '.........HHHHHHHHHHHH...........',
    '.........HH..........HH.........',
    '.........H............H.........',
    '.........H............H.........',
    '.........HH..........HH.........',
    '..........HHHH....HHHH..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Style 2 — Long
  parseRows([
    '................................',
    '..........HHHHHHHHHH............',
    '.........HHHHHHHHHHHH...........',
    '.........HH..........HH.........',
    '.........H............H.........',
    '.........H............H.........',
    '.........H............H.........',
    '.........H............H.........',
    '.........H............H.........',
    '.........H............H.........',
    '.........HH..........HH.........',
    '..........HHHH....HHHH..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Style 3 — Bun
  parseRows([
    '............HHHH................',
    '...........HHHHHH...............',
    '...........HHHHHH...............',
    '..........HHHHHHHHHH............',
    '.........HHHHHHHHHHHH...........',
    '.........HH..........HH.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Style 4 — Curly
  parseRows([
    '................................',
    '.........HHHHHHHHHHHH...........',
    '........HHHHHHHHHHHHHHH.........',
    '........HHH..........HHH........',
    '........HH............HH........',
    '........HHH..........HHH........',
    '.........HHHHHHHHHHHH...........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  // Style 5 — Mohawk
  parseRows([
    '...............HH...............',
    '...............HH...............',
    '..............HHHH..............',
    '..........HHHHHHHHHH............',
    '.........HHHHHHHHHHHH...........',
    '.........HH..........HH.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
];

// Accessories — drawn on top of everything
// Key: glasses, bag, headphones, hat
const ACCESSORY_SHAPES = {
  glasses: parseRows([
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........AA....AA...............',
    '.........AA....AA...............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  bag: parseRows([
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.....BBBBBB.....................',
    '.....BBBBBB.....................',
    '.....BBBBBB.....................',
    '.....BBBBBB.....................',
    '.....BBBBBB.....................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  headphones: parseRows([
    '................................',
    '................................',
    '........PP..........PP..........',
    '........PP..........PP..........',
    '........PP..........PP..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
  hat: parseRows([
    '..........TTTTTTTTTT............',
    '..........TTTTTTTTTT............',
    '..........TTTTTTTTTT............',
    '.......TTTTTTTTTTTTTTTT.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]),
};

const ACCESSORY_COLORS = { A: '#222222', B: '#8b5a35', P: '#1a1a8a', T: '#555555' };
```

- [ ] **Step 2: Add compositing function**

```javascript
function resolveColor(role, parts) {
  if (role === '.') return null;
  if (role === 'S') return SKIN_TONES[parts.skin] || SKIN_TONES[0];
  if (role === 'H') return HAIR_COLORS[parts.hairColor] || HAIR_COLORS[0];
  if (role === 'O') return OUTFIT_COLORS[parts.outfitColor] || OUTFIT_COLORS[0];
  if (role === 'L') return LEG_COLORS[parts.outfitColor] || LEG_COLORS[0];
  return ACCESSORY_COLORS[role] || null;
}

// compositeCharacter is defined in Step 5 (direction-aware, 4 params).
// Define it here with direction support from the start:
function compositeCharacter(ctx, parts, scale = 4, direction = 'south') {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (direction === 'east') {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-ctx.canvas.width, 0);
  }
  const layers = [
    BODY_SHAPES[parts.body] || BODY_SHAPES[0],
    HAIR_SHAPES[parts.hair] || HAIR_SHAPES[0],
  ];
  for (const acc of (parts.accessories || [])) {
    if (ACCESSORY_SHAPES[acc]) layers.push(ACCESSORY_SHAPES[acc]);
  }
  for (const layer of layers) {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const role = layer[y]?.[x];
        const color = resolveColor(role, parts);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  if (direction === 'east') ctx.restore();
  // Note: north/south/west share the same south-facing sprite shape in the assembler.
  // Direction primarily controls which frame row is active (south=0, north=1, west=2, east=3).
}
```

- [ ] **Step 3: Add Parts Assembler CSS**

```css
/* ── PARTS ASSEMBLER ── */
#tab-character { flex-direction: column; }
.char-subtabs {
  display: flex; gap: 2px; padding: 8px 14px 0;
  background: var(--bg1); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.subtab-btn {
  background: none; border: none; padding: 5px 12px;
  border-radius: 6px 6px 0 0; font-size: 12px;
  color: var(--muted); cursor: pointer;
}
.subtab-btn.active { background: var(--bg0); color: var(--accent); border-bottom: 2px solid var(--accent); }
.char-panel { display: none; flex: 1; overflow: hidden; }
.char-panel.active { display: flex; }

/* Assembler three-column layout */
#assembler-panel { gap: 0; }
#assembler-left { width: 200px; overflow-y: auto; flex-shrink: 0; }
#assembler-center {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  padding: 20px; background: var(--bg0);
}
#assembler-right { width: 200px; border-left: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }

.swatch-row { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 0; }
.swatch {
  width: 24px; height: 24px; border-radius: 4px;
  border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s;
}
.swatch.selected { border-color: var(--accent); }
.part-chip {
  padding: 5px 10px; border-radius: 6px; font-size: 12px;
  background: var(--bg2); border: 1px solid var(--border);
  cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.part-chip.selected { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
.parts-grid { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 0; }

canvas.pixel { image-rendering: pixelated; image-rendering: crisp-edges; }
.dir-strip { display: flex; gap: 4px; }
.dir-btn { background: var(--bg2); border: 1px solid var(--border); border-radius: 5px;
           padding: 4px 8px; font-size: 14px; cursor: pointer; }
.dir-btn.active { background: var(--accent-dim); border-color: var(--accent); }

.frame-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
.frame-thumb {
  width: 40px; height: 40px; border: 1px solid var(--border); border-radius: 3px;
  cursor: pointer; image-rendering: pixelated;
}
.frame-thumb.active { border-color: var(--accent); }
```

- [ ] **Step 4: Add Parts Assembler HTML inside `#tab-character`**

```html
<!-- Sub-tab nav -->
<div class="char-subtabs">
  <button class="subtab-btn active" onclick="switchCharSubTab('assembler')">Parts Assembler</button>
  <button class="subtab-btn" onclick="switchCharSubTab('editor')">Pixel Editor</button>
  <button class="subtab-btn" onclick="switchCharSubTab('ai')">AI Generate</button>
</div>

<!-- Assembler panel -->
<div id="assembler-panel" class="char-panel active">
  <div id="assembler-left" class="panel">
    <div class="panel-label">Parts Library</div>

    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Body Type</div>
      <div class="parts-grid" id="body-chips"></div>
    </div>
    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Skin Tone</div>
      <div class="swatch-row" id="skin-swatches"></div>
    </div>
    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Hair Style</div>
      <div class="parts-grid" id="hair-chips"></div>
    </div>
    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Hair Color</div>
      <div class="swatch-row" id="haircolor-swatches"></div>
    </div>
    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Outfit</div>
      <div class="parts-grid" id="outfit-chips"></div>
    </div>
    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Outfit Color</div>
      <div class="swatch-row" id="outfit-swatches"></div>
    </div>
    <div class="section">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Accessories</div>
      <div class="parts-grid" id="acc-chips"></div>
    </div>
  </div>

  <div id="assembler-center">
    <canvas id="assembler-canvas" width="128" height="128" class="pixel"
      style="border:1px solid var(--border);border-radius:4px"></canvas>
    <div class="dir-strip" id="dir-strip">
      <button class="dir-btn" onclick="setDirection('north')">↑</button>
      <button class="dir-btn active" onclick="setDirection('south')">↓</button>
      <button class="dir-btn" onclick="setDirection('west')">←</button>
      <button class="dir-btn" onclick="setDirection('east')">→</button>
    </div>
    <div style="font-size:11px;color:var(--muted)">South-facing · 32px native · 4× display</div>
    <div style="display:flex;gap:8px">
      <button class="btn" onclick="exportAssemblerPNG()">Export PNG</button>
      <button class="btn" onclick="copyAssemblerSheet()">Copy Sheet</button>
      <button class="btn btn-accent" onclick="sendToAIGenerate()">→ AI Generate</button>
    </div>
  </div>

  <div id="assembler-right" class="panel" style="border-left:1px solid var(--border);border-right:none">
    <div class="panel-label">Frames</div>
    <div class="section">
      <div class="frame-strip" id="assembler-frame-strip"></div>
    </div>
    <div class="panel-label" style="margin-top:8px">Preview</div>
    <div class="section" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
      <canvas id="anim-preview" width="44" height="44" class="pixel"
        style="border:1px solid var(--border);border-radius:4px"></canvas>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--muted)">FPS</span>
        <input type="range" min="4" max="24" value="12" id="fps-slider"
          oninput="state.character.fps=+this.value;document.getElementById('fps-val').textContent=this.value;startAnimPreview()"
          style="width:80px">
        <span id="fps-val" style="font-size:11px;color:var(--muted)">12</span>
      </div>
    </div>
  </div>
</div>

<!-- Pixel Editor + AI Generate panels — placeholders until Tasks 5 & 7 -->
<div id="editor-panel" class="char-panel"><!-- Task 5 --></div>
<div id="char-ai-panel" class="char-panel"><!-- Task 7 --></div>
```

- [ ] **Step 5: Add Parts Assembler JS**

```javascript
// ── ASSEMBLER ──
function switchCharSubTab(name) {
  state.character.subTab = name;
  document.querySelectorAll('.char-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(name === 'assembler' ? 'assembler-panel' : name === 'editor' ? 'editor-panel' : 'char-ai-panel').classList.add('active');
  document.querySelectorAll('.subtab-btn').forEach(b => {
    if (b.getAttribute('onclick')?.includes(name)) b.classList.add('active');
  });
  if (name === 'assembler') renderAssembler();
  if (name === 'editor') renderPixelEditor();
}

function initAssembler() {
  // Body chips
  const bc = document.getElementById('body-chips');
  ['Regular','Slim','Round','Tall'].forEach((name, i) => {
    const chip = document.createElement('div');
    chip.className = 'part-chip' + (i === state.character.parts.body ? ' selected' : '');
    chip.textContent = name;
    chip.onclick = () => { state.character.parts.body = i; refreshChips('body-chips', i); renderAssembler(); };
    bc.appendChild(chip);
  });

  // Skin swatches
  buildSwatches('skin-swatches', SKIN_TONES, state.character.parts.skin,
    i => { state.character.parts.skin = i; renderAssembler(); });

  // Hair chips
  const hc = document.getElementById('hair-chips');
  ['Short','Medium','Long','Bun','Curly','Mohawk'].forEach((name, i) => {
    const chip = document.createElement('div');
    chip.className = 'part-chip' + (i === state.character.parts.hair ? ' selected' : '');
    chip.textContent = name;
    chip.onclick = () => { state.character.parts.hair = i; refreshChips('hair-chips', i); renderAssembler(); };
    hc.appendChild(chip);
  });

  // Hair color swatches
  buildSwatches('haircolor-swatches', HAIR_COLORS, state.character.parts.hairColor,
    i => { state.character.parts.hairColor = i; renderAssembler(); });

  // Outfit chips
  const oc = document.getElementById('outfit-chips');
  ['Casual','Formal','Sport','Lab Coat','Hoodie'].forEach((name, i) => {
    const chip = document.createElement('div');
    chip.className = 'part-chip' + (i === state.character.parts.outfit ? ' selected' : '');
    chip.textContent = name;
    chip.onclick = () => { state.character.parts.outfit = i; refreshChips('outfit-chips', i); renderAssembler(); };
    oc.appendChild(chip);
  });

  // Outfit color swatches
  buildSwatches('outfit-swatches', OUTFIT_COLORS, state.character.parts.outfitColor,
    i => { state.character.parts.outfitColor = i; renderAssembler(); });

  // Accessory toggles
  const ac = document.getElementById('acc-chips');
  ['glasses','bag','headphones','hat'].forEach(name => {
    const chip = document.createElement('div');
    const isOn = state.character.parts.accessories.includes(name);
    chip.className = 'part-chip' + (isOn ? ' selected' : '');
    chip.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    chip.onclick = () => {
      const accs = state.character.parts.accessories;
      const idx = accs.indexOf(name);
      if (idx >= 0) accs.splice(idx, 1); else accs.push(name);
      chip.classList.toggle('selected', accs.includes(name));
      renderAssembler();
    };
    ac.appendChild(chip);
  });

  renderAssembler();
  buildFrameStrip();
}

function buildSwatches(containerId, colors, selectedIdx, onChange) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  colors.forEach((c, i) => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (i === selectedIdx ? ' selected' : '');
    sw.style.background = c;
    sw.onclick = () => {
      el.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      onChange(i);
    };
    el.appendChild(sw);
  });
}

function refreshChips(containerId, selectedIdx) {
  document.getElementById(containerId).querySelectorAll('.part-chip').forEach((c, i) => {
    c.classList.toggle('selected', i === selectedIdx);
  });
}

function renderAssembler() {
  const canvas = document.getElementById('assembler-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  compositeCharacter(ctx, state.character.parts, 4, state.character.direction);
}

// Direction maps to a row offset in the 4×4 frame grid:
// south=row0, north=row1, west=row2, east=row3
const DIR_ROW = { south: 0, north: 1, west: 2, east: 3 };

function setDirection(dir) {
  state.character.direction = dir;
  document.querySelectorAll('.dir-btn').forEach((b, i) => {
    b.classList.toggle('active', ['north','south','west','east'][i] === dir);
  });
  // Jump active frame to the first frame of the chosen direction row
  state.character.activeFrame = DIR_ROW[dir] * 4;
  renderAssembler();
  buildFrameStrip();
}

// compositeCharacter is defined above (direction-aware, 4 params).
// No redefinition needed here.

const DIR_ORDER = ['south','north','west','east'];

function buildFrameStrip() {
  const strip = document.getElementById('assembler-frame-strip');
  if (!strip) return;
  strip.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 40; c.className = 'frame-thumb pixel';
    if (i === state.character.activeFrame) c.classList.add('active');
    c.onclick = () => { state.character.activeFrame = i; buildFrameStrip(); };
    const ctx = c.getContext('2d');
    const cellDir = DIR_ORDER[Math.floor(i / 4)]; // row 0=south, 1=north, 2=west, 3=east
    compositeCharacter(ctx, state.character.parts, 1.25, cellDir);
    strip.appendChild(c);
  }
}

function exportAssemblerPNG() {
  const canvas = document.getElementById('assembler-canvas');
  const a = document.createElement('a');
  a.download = 'character.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function copyAssemblerSheet() {
  const canvas = document.getElementById('assembler-canvas');
  canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({'image/png': blob})]));
}

function sendToAIGenerate() {
  const canvas = document.getElementById('assembler-canvas');
  state.character.ai.referenceImage = canvas.toDataURL('image/png');
  state.character.ai.description = 'assembled character from parts assembler';
  switchCharSubTab('ai');
  if (typeof renderCharAI === 'function') renderCharAI();
}
```

- [ ] **Step 6: Replace the DOMContentLoaded listener with this cumulative version**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  initAssembler();
});
```

- [ ] **Step 7: Open in browser → Character Builder tab → Parts Assembler**

Expected: Three-column layout. Left panel shows body type chips, color swatches, hair chips, accessories. Center shows 128×128 canvas with assembled character (colored body + hair). Direction buttons change label active state. Export PNG triggers download. Right panel shows 4×4 frame strip. No console errors.

---

## Task 5: Pixel Editor Sub-tab

**Files:**
- Modify: `~/Downloads/asset-studio.html` — replace `<!-- Task 5 -->` in `#editor-panel`

- [ ] **Step 1: Add Pixel Editor CSS**

Add inside `<style>`:
```css
/* ── PIXEL EDITOR ── */
#editor-panel { gap: 0; }
#pe-toolbar {
  width: 44px; display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 10px 6px;
  background: var(--bg1); border-right: 1px solid var(--border); flex-shrink: 0;
}
.tool-btn {
  width: 32px; height: 32px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg2); font-size: 15px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--text); transition: background 0.15s;
}
.tool-btn.active { background: var(--accent-dim); border-color: var(--accent); }
.tool-btn:hover { background: var(--surface); }
#pe-canvas-wrap {
  flex: 1; display: flex; align-items: center; justify-content: center;
  background: var(--bg0); overflow: hidden; position: relative;
}
#pe-canvas {
  cursor: crosshair; image-rendering: pixelated; image-rendering: crisp-edges;
  border: 1px solid var(--border);
}
#pe-right {
  width: 180px; border-left: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.palette-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 8px; }
.palette-swatch {
  width: 30px; height: 30px; border-radius: 4px;
  border: 2px solid transparent; cursor: pointer;
}
.palette-swatch.selected { border-color: var(--accent); }
#pe-frame-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;
  padding: 8px; overflow-y: auto;
}
.pe-frame-thumb {
  width: 36px; height: 36px; border: 1px solid var(--border);
  border-radius: 3px; cursor: pointer; image-rendering: pixelated;
}
.pe-frame-thumb.active { border-color: var(--accent); }
```

- [ ] **Step 2: Add Pixel Editor HTML inside `#editor-panel`**

```html
<!-- Toolbar -->
<div id="pe-toolbar">
  <button class="tool-btn active" id="tool-pencil" title="Pencil" onclick="setTool('pencil')">✏</button>
  <button class="tool-btn" id="tool-eraser" title="Eraser" onclick="setTool('eraser')">⌫</button>
  <button class="tool-btn" id="tool-fill" title="Fill" onclick="setTool('fill')">🪣</button>
  <button class="tool-btn" id="tool-eyedrop" title="Eyedropper" onclick="setTool('eyedrop')">💉</button>
  <div style="border-top:1px solid var(--border);width:100%;margin:2px 0"></div>
  <button class="tool-btn" title="Undo (⌘Z)" onclick="peUndo()">↩</button>
  <button class="tool-btn" title="Redo (⌘⇧Z)" onclick="peRedo()">↪</button>
  <div style="border-top:1px solid var(--border);width:100%;margin:2px 0"></div>
  <button class="tool-btn" title="Toggle grid" onclick="togglePEGrid()">⊞</button>
</div>

<!-- Canvas -->
<div id="pe-canvas-wrap">
  <canvas id="pe-canvas" width="448" height="448"></canvas>
</div>

<!-- Right: palette + frames -->
<div id="pe-right">
  <div class="panel-label">Color</div>
  <div class="palette-grid" id="pe-palette"></div>
  <input type="color" id="pe-color-picker" style="width:calc(100% - 16px);margin:0 8px 8px;height:28px;cursor:pointer;border-radius:5px;border:1px solid var(--border)">

  <div class="panel-label">Frames</div>
  <div id="pe-frame-grid"></div>

  <div style="padding:8px;margin-top:auto;border-top:1px solid var(--border)">
    <button class="btn btn-accent" style="width:100%" onclick="exportPixelSheet()">Export Sheet</button>
  </div>
</div>
```

- [ ] **Step 3: Add Pixel Editor JS**

```javascript
// ── PIXEL EDITOR ──
const PE_PALETTE = [
  '#000000','#ffffff','#ff0000','#00cc44',
  '#0066ff','#ffcc00','#ff6600','#cc00cc',
  '#00cccc','#996633','#666666','#aaaaaa',
  '#ffcccc','#ccffcc','#ccccff','#ffe0aa',
];
let peActiveTool = 'pencil';
let peActiveColor = '#000000';
let peShowGrid = true;
let peHistory = []; // undo stack — array of frame snapshots
let peRedoStack = [];
const CELL = 14; // px per cell

function initPixelEditor() {
  // Build palette
  const grid = document.getElementById('pe-palette');
  PE_PALETTE.forEach((c, i) => {
    const sw = document.createElement('div');
    sw.className = 'palette-swatch' + (i === 0 ? ' selected' : '');
    sw.style.background = c;
    sw.onclick = () => {
      peActiveColor = c;
      document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('pe-color-picker').value = c;
    };
    grid.appendChild(sw);
  });
  document.getElementById('pe-color-picker').addEventListener('input', e => {
    peActiveColor = e.target.value;
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
  });

  buildPEFrameGrid();
  renderPECanvas();
  attachPEEvents();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); peRedo(); }
    else if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); peUndo(); }
  });
}

function setTool(tool) {
  peActiveTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('tool-' + tool);
  if (el) el.classList.add('active');
}

function attachPEEvents() {
  const canvas = document.getElementById('pe-canvas');
  let painting = false;

  function getCellPos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);
    return { x, y };
  }

  canvas.addEventListener('mousedown', e => {
    painting = true;
    const { x, y } = getCellPos(e);
    pePaint(x, y);
  });
  canvas.addEventListener('mousemove', e => {
    if (!painting) return;
    if (peActiveTool === 'fill' || peActiveTool === 'eyedrop') return;
    const { x, y } = getCellPos(e);
    pePaint(x, y);
  });
  canvas.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('mouseleave', () => { painting = false; });
}

function pePaint(x, y) {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
  const frame = state.character.frames[state.character.activeFrame];
  if (peActiveTool === 'pencil') {
    pushPEHistory();
    frame[y][x] = peActiveColor;
  } else if (peActiveTool === 'eraser') {
    pushPEHistory();
    frame[y][x] = null;
  } else if (peActiveTool === 'fill') {
    pushPEHistory();
    peFloodFill(frame, x, y, frame[y][x], peActiveColor);
  } else if (peActiveTool === 'eyedrop') {
    const c = frame[y][x];
    if (c) {
      peActiveColor = c;
      document.getElementById('pe-color-picker').value = c;
    }
  }
  renderPECanvas();
  updatePEFrameThumb(state.character.activeFrame);
}

function peFloodFill(frame, x, y, targetColor, fillColor) {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
  if (frame[y][x] !== targetColor) return;
  if (targetColor === fillColor) return;
  frame[y][x] = fillColor;
  peFloodFill(frame, x+1, y, targetColor, fillColor);
  peFloodFill(frame, x-1, y, targetColor, fillColor);
  peFloodFill(frame, x, y+1, targetColor, fillColor);
  peFloodFill(frame, x, y-1, targetColor, fillColor);
}

function pushPEHistory() {
  const frame = state.character.frames[state.character.activeFrame];
  peHistory.push(frame.map(row => [...row]));
  if (peHistory.length > 50) peHistory.shift();
  peRedoStack = [];
}

function peUndo() {
  if (!peHistory.length) return;
  const frame = state.character.frames[state.character.activeFrame];
  peRedoStack.push(frame.map(row => [...row]));
  state.character.frames[state.character.activeFrame] = peHistory.pop();
  renderPECanvas();
  updatePEFrameThumb(state.character.activeFrame);
}

function peRedo() {
  if (!peRedoStack.length) return;
  const frame = state.character.frames[state.character.activeFrame];
  peHistory.push(frame.map(row => [...row]));
  state.character.frames[state.character.activeFrame] = peRedoStack.pop();
  renderPECanvas();
  updatePEFrameThumb(state.character.activeFrame);
}

function togglePEGrid() {
  peShowGrid = !peShowGrid;
  renderPECanvas();
}

function renderPECanvas() {
  const canvas = document.getElementById('pe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const frame = state.character.frames[state.character.activeFrame];
  ctx.clearRect(0, 0, 448, 448);

  // Checkerboard background (transparent indicator)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#333340' : '#2a2a36';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  // Pixels
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (frame[y][x]) {
        ctx.fillStyle = frame[y][x];
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  // Grid lines
  if (peShowGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 32; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, 448); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(448, i * CELL); ctx.stroke();
    }
  }
}

function buildPEFrameGrid() {
  const grid = document.getElementById('pe-frame-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const c = document.createElement('canvas');
    c.width = 36; c.height = 36;
    c.className = 'pe-frame-thumb pixel' + (i === state.character.activeFrame ? ' active' : '');
    c.onclick = () => {
      state.character.activeFrame = i;
      buildPEFrameGrid();
      renderPECanvas();
    };
    drawFrameThumb(c.getContext('2d'), state.character.frames[i], 36);
    grid.appendChild(c);
  }
}

function drawFrameThumb(ctx, frame, size) {
  const s = size / 32;
  ctx.clearRect(0, 0, size, size);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (frame[y][x]) {
        ctx.fillStyle = frame[y][x];
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
  }
}

function updatePEFrameThumb(idx) {
  const thumbs = document.querySelectorAll('.pe-frame-thumb');
  if (thumbs[idx]) {
    drawFrameThumb(thumbs[idx].getContext('2d'), state.character.frames[idx], 36);
  }
}

function exportPixelSheet() {
  // Pack all 16 frames into a 4×4 sprite sheet
  const sheet = document.createElement('canvas');
  sheet.width = 128; sheet.height = 128; // 4 cols × 4 rows × 32px
  const ctx = sheet.getContext('2d');
  state.character.frames.forEach((frame, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (frame[y][x]) {
          ctx.fillStyle = frame[y][x];
          ctx.fillRect(col * 32 + x, row * 32 + y, 1, 1);
        }
      }
    }
  });
  const a = document.createElement('a');
  a.download = 'sprite-sheet.png';
  a.href = sheet.toDataURL('image/png');
  a.click();
}

function renderPixelEditor() {
  renderPECanvas();
  buildPEFrameGrid();
}
```

- [ ] **Step 4: Replace the DOMContentLoaded listener with this cumulative version**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  initAssembler();
  initPixelEditor();
});
```

- [ ] **Step 5: Open in browser → Character Builder → Pixel Editor tab**

Expected: Three-column layout. Center shows 448×448 canvas with checkerboard background and grid lines. Left toolbar has pencil/eraser/fill/eyedropper/undo/redo. Right has 16-color palette + color picker + 4×4 frame grid. Drawing on canvas colors pixels. Undo/redo (⌘Z/⌘⇧Z) work. Export Sheet triggers download. No console errors.

---

## Task 6: Character AI Generate Sub-tab

**Files:**
- Modify: `~/Downloads/asset-studio.html` — replace `<!-- Task 7 -->` in `#char-ai-panel`

- [ ] **Step 1: Add AI Generate CSS (shared with Asset Generator)**

```css
/* ── AI GENERATE / ASSET GEN SHARED ── */
.ai-layout { gap: 0; width: 100%; }
.ai-left { width: 240px; border-right: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }
.ai-center {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: flex-start; padding: 20px; gap: 14px; overflow-y: auto; background: var(--bg0);
}
.ai-right { width: 240px; border-left: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }

/* Step indicator */
.step-indicator { display: flex; align-items: center; gap: 0; font-size: 12px; }
.step-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--border); transition: background 0.3s;
}
.step-dot.done { background: var(--green); }
.step-dot.active { background: var(--accent); }
.step-label { color: var(--muted); padding: 0 8px; }
.step-label.active { color: var(--text); font-weight: 500; }

/* Result slot */
.result-slot {
  width: 100%; max-width: 400px; min-height: 200px;
  border: 1px dashed var(--border); border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg1); position: relative; overflow: hidden;
}
.result-slot img { max-width: 100%; max-height: 400px; image-rendering: pixelated; border-radius: 6px; }
.result-slot .empty-hint { color: var(--muted); font-size: 12px; text-align: center; padding: 20px; }
.spinner {
  width: 28px; height: 28px; border: 3px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.spinner-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.spinner-label { font-size: 12px; color: var(--muted); }

/* Variation grid */
.var-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px; }
.var-thumb {
  aspect-ratio: 1; border: 2px solid var(--border); border-radius: 6px;
  cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center;
  background: var(--bg2); font-size: 11px; color: var(--muted);
  image-rendering: pixelated;
}
.var-thumb img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.var-thumb.active { border-color: var(--accent); }
.var-thumb.more { font-size: 20px; }

/* Tweak chips */
.tweak-list { display: flex; flex-direction: column; gap: 4px; padding: 8px; }
.tweak-chip {
  padding: 5px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
  background: var(--bg2); border: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
}
.tweak-chip:hover { border-color: var(--accent); }
.tweak-arrow { color: var(--muted); font-size: 10px; }

/* History list */
.history-list { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
.history-item {
  display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 6px;
  cursor: pointer; background: var(--bg2); border: 1px solid transparent;
}
.history-item:hover { border-color: var(--border); }
.history-item img { width: 36px; height: 36px; object-fit: contain; border-radius: 3px; image-rendering: pixelated; }
.history-meta { flex: 1; overflow: hidden; }
.history-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-time { font-size: 10px; color: var(--muted); }

/* Ref image upload */
.ref-upload {
  border: 1px dashed var(--border); border-radius: 6px;
  padding: 10px; text-align: center; font-size: 11px; color: var(--muted);
  cursor: pointer; transition: border-color 0.15s;
}
.ref-upload:hover { border-color: var(--accent); }
.ref-upload.has-image { border-style: solid; border-color: var(--accent); }
```

- [ ] **Step 2: Add Character AI Generate HTML inside `#char-ai-panel`**

```html
<div class="ai-layout" style="display:flex;height:100%">
  <!-- Left config -->
  <div class="ai-left panel">
    <div class="panel-label">Configure</div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Description</label>
      <textarea id="char-ai-desc" rows="3" placeholder="A cheerful office worker with glasses…"
        oninput="state.character.ai.description=this.value" style="margin-top:4px;resize:vertical"></textarea>
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Reference Image (optional)</label>
      <div class="ref-upload" id="char-ref-drop" onclick="document.getElementById('char-ref-input').click()" style="margin-top:4px">
        <div id="char-ref-preview">Drop image or click to upload</div>
      </div>
      <input type="file" id="char-ref-input" accept="image/*" style="display:none" onchange="loadRefImage(this,'char','char-ref-preview','char-ref-drop')">
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Grid Size</label>
      <select id="char-grid-size" onchange="state.character.ai.gridSize=+this.value" style="margin-top:4px">
        <option value="2">2×2 (4 frames)</option>
        <option value="3">3×3 (9 frames)</option>
        <option value="4" selected>4×4 (16 frames)</option>
        <option value="5">5×5 (25 frames)</option>
        <option value="6">6×6 (36 frames)</option>
      </select>
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Animation Actions</label>
      <div id="char-actions" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px"></div>
      <input type="text" id="char-custom-action" placeholder="Custom action…" style="margin-top:6px;font-size:12px">
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Art Style</label>
      <select id="char-art-style" onchange="state.character.ai.artStyle=this.value" style="margin-top:4px">
        <option value="pixel-art">Pixel Art</option>
        <option value="chibi">Chibi</option>
        <option value="stardew-warm">Stardew-Warm</option>
        <option value="retro-8bit">Retro 8-bit</option>
      </select>
    </div>
    <div class="section" style="display:flex;gap:8px">
      <button class="btn" id="char-enhance-btn" onclick="charEnhance()" style="flex:1">✦ Enhance</button>
      <button class="btn btn-accent" id="char-generate-btn" onclick="charGenerate()" style="flex:1">▶ Generate</button>
    </div>
    <div id="char-ai-error" style="padding:8px"></div>
  </div>

  <!-- Center -->
  <div class="ai-center">
    <div class="step-indicator" id="char-steps">
      <div class="step-dot active" id="char-s1"></div>
      <span class="step-label active">Configure</span>
      <div class="step-dot" id="char-s2"></div>
      <span class="step-label">Enhance</span>
      <div class="step-dot" id="char-s3"></div>
      <span class="step-label">Generate</span>
    </div>

    <textarea id="char-enhanced-prompt" rows="5" placeholder="Enhanced prompt will appear here after clicking Enhance…"
      oninput="state.character.ai.enhancedPrompt=this.value"
      style="width:100%;max-width:500px;font-size:11px;font-family:monospace;resize:vertical"></textarea>

    <div class="result-slot" id="char-result-slot">
      <div class="empty-hint">Generate an image to see the result</div>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn" id="char-dl-btn" onclick="downloadResult('char')" disabled>⬇ Download PNG</button>
      <button class="btn" id="char-rmbg-btn" onclick="openRemoveBG('char')" disabled>Remove BG</button>
      <button class="btn" id="char-addsheet-btn" onclick="addToSheet('char')" disabled>Add to Sheet</button>
    </div>
  </div>

  <!-- Right: variations + tweaks + history -->
  <div class="ai-right panel">
    <div class="panel-label">Variations</div>
    <div class="var-grid" id="char-var-grid">
      <div class="var-thumb active" id="char-v0" style="font-size:11px">V1</div>
      <div class="var-thumb" id="char-v1" style="font-size:11px">V2</div>
      <div class="var-thumb" id="char-v2" style="font-size:11px">V3</div>
      <div class="var-thumb more" onclick="charGenerateVariations()">+</div>
    </div>

    <div class="panel-label">Tweaks</div>
    <div class="tweak-list" id="char-tweaks"></div>

    <div class="panel-label">History</div>
    <div class="history-list" id="char-history-list"></div>
  </div>
</div>
```

- [ ] **Step 3: Add Character AI Generate JS**

```javascript
// ── CHAR AI GENERATE ──
const CHAR_TWEAKS = [
  'Darker tones', 'Stronger shadow', 'Warmer palette',
  'Larger footprint', 'More detail', 'Softer colors',
];

function initCharAI() {
  // Action checkboxes
  const actions = ['idle','walk','run','attack','cast','jump','dance','death'];
  const container = document.getElementById('char-actions');
  actions.forEach(a => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = a;
    cb.checked = state.character.ai.actions.includes(a);
    cb.onchange = () => {
      if (cb.checked) state.character.ai.actions.push(a);
      else state.character.ai.actions = state.character.ai.actions.filter(x => x !== a);
    };
    label.appendChild(cb);
    label.appendChild(document.createTextNode(a));
    container.appendChild(label);
  });

  // Tweaks
  const tweakList = document.getElementById('char-tweaks');
  CHAR_TWEAKS.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'tweak-chip';
    chip.innerHTML = `<span>${t}</span><span class="tweak-arrow">→ regen</span>`;
    chip.onclick = () => {
      state.character.ai.description += '. ' + t;
      document.getElementById('char-ai-desc').value = state.character.ai.description;
      charGenerate();
    };
    tweakList.appendChild(chip);
  });
  const customInput = document.getElementById('char-custom-action');
  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && customInput.value.trim()) {
      state.character.ai.description += '. ' + customInput.value.trim();
      document.getElementById('char-ai-desc').value = state.character.ai.description;
      customInput.value = '';
      charGenerate();
    }
  });

  // Restore state
  document.getElementById('char-ai-desc').value = state.character.ai.description;
  document.getElementById('char-enhanced-prompt').value = state.character.ai.enhancedPrompt;
  renderCharHistory();
  renderCharVariations();
}

function renderCharAI() {
  if (state.character.ai.referenceImage) {
    const prev = document.getElementById('char-ref-preview');
    prev.innerHTML = `<img src="${state.character.ai.referenceImage}" style="max-height:60px;max-width:100%;border-radius:4px">`;
    document.getElementById('char-ref-drop').classList.add('has-image');
  }
  document.getElementById('char-ai-desc').value = state.character.ai.description;
}

async function charEnhance() {
  const btn = document.getElementById('char-enhance-btn');
  btn.textContent = 'Thinking…'; btn.disabled = true;
  document.getElementById('char-ai-error').innerHTML = '';
  try {
    const { description, gridSize, actions, artStyle, referenceImage } = state.character.ai;
    const actionList = actions.join(', ');
    const messages = [];
    const userContent = [];
    if (referenceImage) userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: referenceImage.split(',')[1] } });
    userContent.push({ type: 'text', text:
`You are a pixel art asset director for a top-down oblique office life sim (Stardew Valley aesthetic). The game uses square tiles (~65° camera), NOT true isometric projection.

${state.settings.gameContext}

User's character description: ${description}
${referenceImage ? 'Use the attached image as visual reference.' : ''}

Generate a detailed image generation prompt for:
- Sprite sheet: ${gridSize}×${gridSize} grid = ${gridSize*gridSize} frames
- Row layout: one row per animation (${actionList})
- Style: ${artStyle}, 3-step shading, clean outlines, no dithering
- Background: transparent

Output ONLY the enhanced prompt text, nothing else.` });
    messages.push({ role: 'user', content: userContent });

    const result = await callClaude(messages, { maxTokens: 800 });
    state.character.ai.enhancedPrompt = result;
    document.getElementById('char-enhanced-prompt').value = result;
    setCharStep(2);
  } catch (e) {
    showError('char-ai-error', e.message);
  } finally {
    btn.textContent = '✦ Enhance'; btn.disabled = false;
  }
}

async function charGenerate() {
  if (!state.character.ai.enhancedPrompt) { await charEnhance(); }
  const btn = document.getElementById('char-generate-btn');
  btn.textContent = 'Generating…'; btn.disabled = true;
  document.getElementById('char-ai-error').innerHTML = '';
  const slot = document.getElementById('char-result-slot');
  slot.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><div class="spinner-label">Generating image…<br>~15s remaining</div></div>`;
  try {
    const seed = Math.floor(Math.random() * 2147483647);
    const b64 = await callImageGen(state.character.ai.enhancedPrompt, seed);
    state.character.ai.result = b64;
    slot.innerHTML = `<img src="${b64}" alt="Generated character">`;
    ['char-dl-btn','char-rmbg-btn','char-addsheet-btn'].forEach(id => document.getElementById(id).disabled = false);
    setCharStep(3);
    addToHistory('character', b64, state.character.ai.description);
    // Place as first variation
    state.character.ai.variations[0] = b64;
    renderCharVariations();
    renderCharHistory();
  } catch (e) {
    slot.innerHTML = '';
    showError('char-ai-error', e.message);
  } finally {
    btn.textContent = '▶ Generate'; btn.disabled = false;
  }
}

async function charGenerateVariations() {
  if (!state.character.ai.enhancedPrompt) return;
  const grid = document.getElementById('char-var-grid');
  grid.querySelectorAll('.var-thumb:not(.more)').forEach(v => { v.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div>'; });
  try {
    const seeds = Array.from({length: 4}, () => Math.floor(Math.random() * 2147483647));
    const results = await Promise.allSettled(seeds.map(s => callImageGen(state.character.ai.enhancedPrompt, s)));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') state.character.ai.variations[i] = r.value;
    });
    renderCharVariations();
  } catch (e) {
    showError('char-ai-error', e.message);
  }
}

function renderCharVariations() {
  const grid = document.getElementById('char-var-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const div = document.createElement('div');
    div.className = 'var-thumb' + (i === 0 ? ' active' : '');
    const v = state.character.ai.variations[i];
    div.innerHTML = v ? `<img src="${v}">` : `<span>V${i+1}</span>`;
    div.onclick = () => {
      if (!v) return;
      state.character.ai.result = v;
      document.getElementById('char-result-slot').innerHTML = `<img src="${v}">`;
      grid.querySelectorAll('.var-thumb').forEach(t => t.classList.remove('active'));
      div.classList.add('active');
    };
    grid.appendChild(div);
  }
  const more = document.createElement('div');
  more.className = 'var-thumb more';
  more.textContent = '+';
  more.onclick = charGenerateVariations;
  grid.appendChild(more);
}

function setCharStep(step) {
  const dots = ['char-s1','char-s2','char-s3'];
  dots.forEach((id, i) => {
    const el = document.getElementById(id);
    el.className = 'step-dot' + (i + 1 < step ? ' done' : i + 1 === step ? ' active' : '');
  });
}

function renderCharHistory() {
  const list = document.getElementById('char-history-list');
  if (!list) return;
  list.innerHTML = '';
  state.character.ai.history.slice().reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<img src="${item.img}"><div class="history-meta"><div class="history-name">${escHtml(item.name)}</div><div class="history-time">${timeAgo(item.ts)}</div></div>`;
    div.onclick = () => {
      state.character.ai.result = item.img;
      document.getElementById('char-result-slot').innerHTML = `<img src="${item.img}">`;
    };
    list.appendChild(div);
  });
}
```

- [ ] **Step 4: Add shared history + time helpers**

```javascript
// ── HISTORY HELPERS ──
function addToHistory(tab, img, name) {
  const arr = tab === 'character' ? state.character.ai.history : state.asset.history;
  arr.push({ img, name: name || 'Generation', ts: Date.now() });
  if (arr.length > 20) arr.shift();
  localStorage.setItem('history_' + tab, JSON.stringify(arr));
}

function loadHistories() {
  const ch = localStorage.getItem('history_character');
  if (ch) state.character.ai.history = JSON.parse(ch);
  const ah = localStorage.getItem('history_asset');
  if (ah) state.asset.history = JSON.parse(ah);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function loadRefImage(input, tab, previewId, dropId) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result;
    if (tab === 'char') state.character.ai.referenceImage = b64;
    else state.asset.referenceImage = b64;
    document.getElementById(previewId).innerHTML =
      `<img src="${b64}" style="max-height:60px;max-width:100%;border-radius:4px">`;
    document.getElementById(dropId).classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function downloadResult(tab) {
  const src = tab === 'char' ? state.character.ai.result : state.asset.result;
  if (!src) return;
  const a = document.createElement('a');
  a.download = tab + '-result.png'; a.href = src; a.click();
}

function addToSheet(tab) {
  alert('Add to Sheet: coming in a future update.');
}
```

- [ ] **Step 5: Replace the DOMContentLoaded listener with this cumulative version**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadHistories();
  initSettings();
  initAssembler();
  initPixelEditor();
  initCharAI();
});
```

- [ ] **Step 6: Open in browser → Character Builder → AI Generate tab**

Expected: Three-column layout. Left has description textarea, reference image upload, grid size dropdown, action checkboxes, art style dropdown, Enhance + Generate buttons. Center has step indicator, enhanced prompt textarea, result slot with empty state, disabled action buttons. Right has 4 variation thumbs + More, tweak chips, empty history. Enhance button calls Claude and fills prompt (requires API key in Settings). Generate calls image gen. Variations panel generates 4 parallel calls. History list persists across reloads.

---

## Task 7: Asset Generator Tab

**Files:**
- Modify: `~/Downloads/asset-studio.html` — replace `<!-- Task 7 -->` in `#tab-asset`

- [ ] **Step 1: Add Asset Generator HTML inside `#tab-asset`**

```html
<div class="ai-layout" style="display:flex;height:100%">
  <!-- Left config -->
  <div class="ai-left panel">
    <div class="panel-label">Configure</div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Asset Type</label>
      <div style="display:flex;gap:4px;margin-top:6px" id="asset-type-btns">
        <button class="btn active" onclick="setAssetType('furniture',this)">Furniture</button>
        <button class="btn" onclick="setAssetType('floor',this)">Floor Tile</button>
        <button class="btn" onclick="setAssetType('prop',this)">Prop</button>
      </div>
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Description</label>
      <textarea id="asset-desc" rows="3" placeholder="A wooden office desk with drawers…"
        oninput="state.asset.description=this.value" style="margin-top:4px;resize:vertical"></textarea>
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Reference Image (optional)</label>
      <div class="ref-upload" id="asset-ref-drop" onclick="document.getElementById('asset-ref-input').click()" style="margin-top:4px">
        <div id="asset-ref-preview">Drop image or click to upload</div>
      </div>
      <input type="file" id="asset-ref-input" accept="image/*" style="display:none" onchange="loadRefImage(this,'asset','asset-ref-preview','asset-ref-drop')">
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Palette</label>
      <select id="asset-palette" onchange="state.asset.palette=this.value" style="margin-top:4px">
        <option value="warm">Warm</option>
        <option value="cool">Cool</option>
        <option value="earthy">Earthy</option>
        <option value="vivid">Vivid</option>
      </select>
    </div>
    <div class="section">
      <label style="font-size:11px;color:var(--muted)">Shadow</label>
      <select id="asset-shadow" onchange="state.asset.shadow=this.value" style="margin-top:4px">
        <option value="subtle">Subtle</option>
        <option value="medium">Medium</option>
        <option value="none">None</option>
      </select>
    </div>
    <div class="section" style="font-size:11px;color:var(--green)">
      ✓ Top-down Oblique — matches your game
    </div>
    <div class="section" style="display:flex;gap:8px">
      <button class="btn" id="asset-enhance-btn" onclick="assetEnhance()" style="flex:1">✦ Enhance</button>
      <button class="btn btn-accent" id="asset-generate-btn" onclick="assetGenerate()" style="flex:1">▶ Generate</button>
    </div>
    <div id="asset-error" style="padding:8px"></div>
  </div>

  <!-- Center -->
  <div class="ai-center">
    <div class="step-indicator" id="asset-steps">
      <div class="step-dot active" id="asset-s1"></div>
      <span class="step-label active">Configure</span>
      <div class="step-dot" id="asset-s2"></div>
      <span class="step-label">Enhance</span>
      <div class="step-dot" id="asset-s3"></div>
      <span class="step-label">Generate</span>
    </div>

    <textarea id="asset-enhanced-prompt" rows="5"
      placeholder="Enhanced prompt will appear here after clicking Enhance…"
      oninput="state.asset.enhancedPrompt=this.value"
      style="width:100%;max-width:500px;font-size:11px;font-family:monospace;resize:vertical"></textarea>

    <div class="result-slot" id="asset-result-slot">
      <div class="empty-hint">Generate an image to see the result</div>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn" id="asset-dl-btn" onclick="downloadResult('asset')" disabled>⬇ Download PNG</button>
      <button class="btn" id="asset-rmbg-btn" onclick="openRemoveBG('asset')" disabled>Remove BG</button>
      <button class="btn" id="asset-addsheet-btn" onclick="addToSheet('asset')" disabled>Add to Sheet</button>
    </div>
  </div>

  <!-- Right -->
  <div class="ai-right panel">
    <div class="panel-label">Variations</div>
    <div class="var-grid" id="asset-var-grid">
      <div class="var-thumb active" style="font-size:11px">V1</div>
      <div class="var-thumb" style="font-size:11px">V2</div>
      <div class="var-thumb" style="font-size:11px">V3</div>
      <div class="var-thumb more" onclick="assetGenerateVariations()">+</div>
    </div>

    <div class="panel-label">Tweaks</div>
    <div class="tweak-list" id="asset-tweaks"></div>

    <div class="panel-label">History</div>
    <div class="history-list" id="asset-history-list"></div>
  </div>
</div>
```

- [ ] **Step 2: Add Asset Generator JS**

```javascript
// ── ASSET GENERATOR ──
function setAssetType(type, btn) {
  state.asset.type = type;
  document.querySelectorAll('#asset-type-btns .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function initAssetGen() {
  const tweakList = document.getElementById('asset-tweaks');
  CHAR_TWEAKS.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'tweak-chip';
    chip.innerHTML = `<span>${t}</span><span class="tweak-arrow">→ regen</span>`;
    chip.onclick = () => {
      state.asset.description += '. ' + t;
      document.getElementById('asset-desc').value = state.asset.description;
      assetGenerate();
    };
    tweakList.appendChild(chip);
  });
  document.getElementById('asset-desc').value = state.asset.description;
  document.getElementById('asset-enhanced-prompt').value = state.asset.enhancedPrompt;
  renderAssetHistory();
  renderAssetVariations();
}

async function assetEnhance() {
  const btn = document.getElementById('asset-enhance-btn');
  btn.textContent = 'Thinking…'; btn.disabled = true;
  document.getElementById('asset-error').innerHTML = '';
  try {
    const { type, description, palette, shadow, referenceImage } = state.asset;
    const userContent = [];
    if (referenceImage) userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: referenceImage.split(',')[1] } });
    userContent.push({ type: 'text', text:
`You are a pixel art asset director for a top-down oblique office life sim.

${state.settings.gameContext}

Generate a detailed image generation prompt for a single ${type} asset:
Description: ${description}
Projection: top-down oblique (south-facing front view, ~65° camera, no isometric diamond tiles, no side faces)
Tile footprint: 32×32px standard, 32×64px for tall objects
Shadow: ${shadow} — cast directly below and slightly south
Palette: ${palette}
Style: 3-step shading, clean outlines, no dithering, transparent background

Output ONLY the enhanced prompt text.` });
    const messages = [{ role: 'user', content: userContent }];
    const result = await callClaude(messages, { maxTokens: 600 });
    state.asset.enhancedPrompt = result;
    document.getElementById('asset-enhanced-prompt').value = result;
    setAssetStep(2);
  } catch (e) {
    showError('asset-error', e.message);
  } finally {
    btn.textContent = '✦ Enhance'; btn.disabled = false;
  }
}

async function assetGenerate() {
  if (!state.asset.enhancedPrompt) { await assetEnhance(); }
  const btn = document.getElementById('asset-generate-btn');
  btn.textContent = 'Generating…'; btn.disabled = true;
  document.getElementById('asset-error').innerHTML = '';
  const slot = document.getElementById('asset-result-slot');
  slot.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><div class="spinner-label">Generating image…<br>~15s remaining</div></div>`;
  try {
    const seed = Math.floor(Math.random() * 2147483647);
    const b64 = await callImageGen(state.asset.enhancedPrompt, seed);
    state.asset.result = b64;
    slot.innerHTML = `<img src="${b64}" alt="Generated asset">`;
    ['asset-dl-btn','asset-rmbg-btn','asset-addsheet-btn'].forEach(id => document.getElementById(id).disabled = false);
    setAssetStep(3);
    addToHistory('asset', b64, state.asset.description);
    state.asset.variations[0] = b64;
    renderAssetVariations();
    renderAssetHistory();
  } catch (e) {
    slot.innerHTML = '';
    showError('asset-error', e.message);
  } finally {
    btn.textContent = '▶ Generate'; btn.disabled = false;
  }
}

async function assetGenerateVariations() {
  if (!state.asset.enhancedPrompt) return;
  const grid = document.getElementById('asset-var-grid');
  grid.querySelectorAll('.var-thumb:not(.more)').forEach(v => {
    v.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div>';
  });
  try {
    const seeds = Array.from({length: 4}, () => Math.floor(Math.random() * 2147483647));
    const results = await Promise.allSettled(seeds.map(s => callImageGen(state.asset.enhancedPrompt, s)));
    results.forEach((r, i) => { if (r.status === 'fulfilled') state.asset.variations[i] = r.value; });
    renderAssetVariations();
  } catch (e) { showError('asset-error', e.message); }
}

function renderAssetVariations() {
  const grid = document.getElementById('asset-var-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const div = document.createElement('div');
    div.className = 'var-thumb' + (i === 0 ? ' active' : '');
    const v = state.asset.variations[i];
    div.innerHTML = v ? `<img src="${v}">` : `<span>V${i+1}</span>`;
    div.onclick = () => {
      if (!v) return;
      state.asset.result = v;
      document.getElementById('asset-result-slot').innerHTML = `<img src="${v}">`;
      grid.querySelectorAll('.var-thumb').forEach(t => t.classList.remove('active'));
      div.classList.add('active');
    };
    grid.appendChild(div);
  }
  const more = document.createElement('div');
  more.className = 'var-thumb more'; more.textContent = '+';
  more.onclick = assetGenerateVariations;
  grid.appendChild(more);
}

function setAssetStep(step) {
  ['asset-s1','asset-s2','asset-s3'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.className = 'step-dot' + (i+1 < step ? ' done' : i+1 === step ? ' active' : '');
  });
}

function renderAssetHistory() {
  const list = document.getElementById('asset-history-list');
  if (!list) return;
  list.innerHTML = '';
  state.asset.history.slice().reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<img src="${item.img}"><div class="history-meta"><div class="history-name">${escHtml(item.name)}</div><div class="history-time">${timeAgo(item.ts)}</div></div>`;
    div.onclick = () => {
      state.asset.result = item.img;
      document.getElementById('asset-result-slot').innerHTML = `<img src="${item.img}">`;
    };
    list.appendChild(div);
  });
}
```

- [ ] **Step 3: Replace the DOMContentLoaded listener with this cumulative version**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadHistories();
  initSettings();
  initAssembler();
  initPixelEditor();
  initCharAI();
  initAssetGen();
});
```

- [ ] **Step 4: Open in browser → Asset Generator tab**

Expected: Identical three-column layout to Character AI Generate. Asset type segmented control (Furniture/Floor Tile/Prop) switches `state.asset.type`. "✓ Top-down Oblique" note is visible. Enhance → Generate flow works same as Character AI Generate. Variations, tweaks, history behave identically.

---

## Task 8: Sheet Analyzer Tab

**Files:**
- Modify: `~/Downloads/asset-studio.html` — replace `<!-- Task 8 -->` in `#tab-analyzer`

- [ ] **Step 1: Add Sheet Analyzer CSS**

```css
/* ── SHEET ANALYZER ── */
#tab-analyzer { gap: 0; }
#analyzer-left { width: 220px; border-right: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }
#analyzer-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 16px; gap: 10px; background: var(--bg0); overflow: auto; }
#analyzer-right { width: 260px; border-left: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }

.drop-zone {
  border: 2px dashed var(--border); border-radius: 8px;
  padding: 20px; text-align: center; font-size: 12px; color: var(--muted);
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.drop-zone:hover, .drop-zone.drag-over { border-color: var(--accent); background: var(--accent-dim); }
.drop-zone.has-file { border-color: var(--green); border-style: solid; }
.drop-zone img { max-width: 100%; max-height: 80px; border-radius: 4px; margin-top: 8px; }

#analyzer-canvas-wrap { position: relative; display: inline-block; }
#analyzer-canvas { image-rendering: pixelated; image-rendering: crisp-edges; border: 1px solid var(--border); }
#analyzer-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }
.analyzer-status { font-size: 11px; color: var(--muted); }

.result-card {
  background: var(--bg1); border: 1px solid var(--border); border-radius: 8px;
  padding: 12px; margin: 6px 8px;
}
.result-card h4 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 6px; }
.result-card .value { font-size: 14px; font-weight: 600; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge-ok { background: rgba(92,191,122,0.15); color: var(--green); }
.badge-warn { background: rgba(224,92,92,0.12); color: var(--red); }
.anim-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
.anim-row-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.analyzer-empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 10px; color: var(--muted); text-align: center; padding: 20px; }
```

- [ ] **Step 2: Add Sheet Analyzer HTML inside `#tab-analyzer`**

```html
<!-- Left: upload + controls -->
<div id="analyzer-left" class="panel">
  <div class="panel-label">Upload Sheet</div>
  <div class="section">
    <div class="drop-zone" id="analyzer-drop"
      onclick="document.getElementById('analyzer-file').click()"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="handleAnalyzerDrop(event)">
      <div id="analyzer-drop-content">Drop PNG/JPG or click to upload<br>(max 10MB)</div>
    </div>
    <input type="file" id="analyzer-file" accept="image/png,image/jpeg,image/webp" style="display:none"
      onchange="loadAnalyzerSheet(this.files[0])">
  </div>

  <div class="panel-label">Grid Overlay</div>
  <div class="section">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="font-size:11px;color:var(--muted)">Columns</label>
        <input type="range" min="1" max="16" value="4" id="grid-cols"
          oninput="state.analyzer.gridCols=+this.value;document.getElementById('grid-cols-val').textContent=this.value;updateAnalyzerOverlay()">
        <span id="grid-cols-val" style="font-size:11px;color:var(--muted)">4</span>
      </div>
      <div>
        <label style="font-size:11px;color:var(--muted)">Rows</label>
        <input type="range" min="1" max="16" value="4" id="grid-rows"
          oninput="state.analyzer.gridRows=+this.value;document.getElementById('grid-rows-val').textContent=this.value;updateAnalyzerOverlay()">
        <span id="grid-rows-val" style="font-size:11px;color:var(--muted)">4</span>
      </div>
      <div>
        <label style="font-size:11px;color:var(--muted)">Frame W</label>
        <input type="range" min="8" max="128" value="32" id="frame-w"
          oninput="state.analyzer.frameW=+this.value;document.getElementById('frame-w-val').textContent=this.value;updateAnalyzerOverlay()">
        <span id="frame-w-val" style="font-size:11px;color:var(--muted)">32</span>
      </div>
      <div>
        <label style="font-size:11px;color:var(--muted)">Frame H</label>
        <input type="range" min="8" max="128" value="32" id="frame-h"
          oninput="state.analyzer.frameH=+this.value;document.getElementById('frame-h-val').textContent=this.value;updateAnalyzerOverlay()">
        <span id="frame-h-val" style="font-size:11px;color:var(--muted)">32</span>
      </div>
    </div>
  </div>

  <div class="section">
    <button class="btn btn-accent" style="width:100%" id="analyze-btn" onclick="runAnalysis()" disabled>
      ✦ Analyze with Claude
    </button>
  </div>
  <div id="analyzer-error" style="padding:8px"></div>
</div>

<!-- Center: sheet preview -->
<div id="analyzer-center">
  <div id="analyzer-canvas-wrap" style="display:none">
    <canvas id="analyzer-canvas"></canvas>
    <canvas id="analyzer-overlay"></canvas>
  </div>
  <div class="analyzer-status" id="analyzer-status">Upload a sprite sheet to get started</div>
</div>

<!-- Right: results -->
<div id="analyzer-right" class="panel">
  <div id="analyzer-results">
    <div class="analyzer-empty">
      <div style="font-size:32px">📊</div>
      <div>Upload a sheet and click<br>Analyze with Claude to see projection,<br>frame size, and animation breakdown.</div>
    </div>
  </div>
  <div style="padding:8px;margin-top:auto">
    <button class="btn" style="width:100%" id="gen-prompt-btn" onclick="generateMatchingPrompt()" disabled>
      ⬇ Generate Matching Prompt
    </button>
    <div id="analyzer-prompt-out" style="margin-top:8px"></div>
  </div>
</div>
```

- [ ] **Step 3: Add Sheet Analyzer JS**

```javascript
// ── SHEET ANALYZER ──
let analyzerImage = null; // HTMLImageElement

function handleAnalyzerDrop(e) {
  e.preventDefault();
  document.getElementById('analyzer-drop').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadAnalyzerSheet(file);
}

function loadAnalyzerSheet(file) {
  if (!file || file.size > 10 * 1024 * 1024) { alert('Max file size is 10MB'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    state.analyzer.sheet = e.target.result;
    const img = new Image();
    img.onload = () => {
      analyzerImage = img;
      renderAnalyzerSheet();
      document.getElementById('analyze-btn').disabled = false;
      document.getElementById('analyzer-drop').classList.add('has-file');
      document.getElementById('analyzer-drop-content').innerHTML =
        `<img src="${state.analyzer.sheet}"><div style="margin-top:4px;font-size:10px">${file.name}</div>`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderAnalyzerSheet() {
  if (!analyzerImage) return;
  const wrap = document.getElementById('analyzer-canvas-wrap');
  wrap.style.display = 'block';
  const maxW = document.getElementById('analyzer-center').clientWidth - 40;
  const maxH = document.getElementById('analyzer-center').clientHeight - 80;
  const scale = Math.min(maxW / analyzerImage.width, maxH / analyzerImage.height, 4);
  const w = Math.round(analyzerImage.width * scale);
  const h = Math.round(analyzerImage.height * scale);

  const canvas = document.getElementById('analyzer-canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(analyzerImage, 0, 0, w, h);

  const overlay = document.getElementById('analyzer-overlay');
  overlay.width = w; overlay.height = h;
  overlay.style.width = w + 'px'; overlay.style.height = h + 'px';
  updateAnalyzerOverlay();

  const { gridCols, gridRows } = state.analyzer;
  document.getElementById('analyzer-status').textContent =
    `Zoom: ${scale.toFixed(1)}× · ${analyzerImage.width}×${analyzerImage.height}px · ${gridCols}×${gridRows} grid`;
}

function updateAnalyzerOverlay() {
  if (!analyzerImage) return;
  const canvas = document.getElementById('analyzer-canvas');
  const overlay = document.getElementById('analyzer-overlay');
  if (!canvas.width) return;
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const { gridCols, gridRows } = state.analyzer;
  const cellW = overlay.width / gridCols;
  const cellH = overlay.height / gridRows;

  ctx.strokeStyle = 'rgba(245,197,66,0.5)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= gridCols; c++) {
    ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, overlay.height); ctx.stroke();
  }
  for (let r = 0; r <= gridRows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(overlay.width, r * cellH); ctx.stroke();
  }

  // Row labels
  ctx.fillStyle = 'rgba(245,197,66,0.6)';
  ctx.font = '10px monospace';
  for (let r = 0; r < gridRows; r++) {
    ctx.fillText('Row ' + r, 3, r * cellH + 13);
  }
}

async function runAnalysis() {
  if (!state.analyzer.sheet) return;
  const btn = document.getElementById('analyze-btn');
  btn.textContent = 'Analyzing…'; btn.disabled = true;
  document.getElementById('analyzer-error').innerHTML = '';
  document.getElementById('analyzer-results').innerHTML =
    '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner"></div></div>';
  try {
    const b64 = state.analyzer.sheet.split(',')[1];
    const mediaType = state.analyzer.sheet.split(';')[0].split(':')[1];
    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text:
`Analyze this sprite sheet image for use in a pixel art game.

Identify and respond with exactly this JSON structure (no markdown, no explanation):
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
}` }
      ]
    }];
    const raw = await callClaude(messages, { maxTokens: 1000 });
    const json = JSON.parse(raw.replace(/```json\n?/,'').replace(/```\n?/,'').trim());
    state.analyzer.analysisResult = json;

    // Sync grid controls to detected values
    if (json.columns) { state.analyzer.gridCols = json.columns; document.getElementById('grid-cols').value = json.columns; document.getElementById('grid-cols-val').textContent = json.columns; }
    if (json.rows) { state.analyzer.gridRows = json.rows; document.getElementById('grid-rows').value = json.rows; document.getElementById('grid-rows-val').textContent = json.rows; }
    if (json.frame_width_px) { state.analyzer.frameW = json.frame_width_px; document.getElementById('frame-w').value = json.frame_width_px; document.getElementById('frame-w-val').textContent = json.frame_width_px; }
    if (json.frame_height_px) { state.analyzer.frameH = json.frame_height_px; document.getElementById('frame-h').value = json.frame_height_px; document.getElementById('frame-h-val').textContent = json.frame_height_px; }
    updateAnalyzerOverlay();

    renderAnalysisResults(json);
    document.getElementById('gen-prompt-btn').disabled = false;
  } catch (e) {
    document.getElementById('analyzer-results').innerHTML = '';
    showError('analyzer-error', 'Analysis failed: ' + e.message);
  } finally {
    btn.textContent = '✦ Analyze with Claude'; btn.disabled = false;
  }
}

const ROW_COLORS = ['#e05c5c','#f5c542','#5cbf7a','#4a7fc1','#bb55bb','#c07a1e','#5cbfd0','#aaaaaa'];

function renderAnalysisResults(r) {
  const compat = r.compatible_with_oblique_game;
  const animRows = (r.animation_rows || []).map((ar, i) =>
    `<div class="anim-row">
      <div class="anim-row-dot" style="background:${ROW_COLORS[i % ROW_COLORS.length]}"></div>
      <span>Row ${ar.row}</span>
      <span style="color:var(--text);font-weight:500">${escHtml(ar.name)}</span>
      <span style="color:var(--muted);font-size:10px">${ar.confidence}</span>
    </div>`
  ).join('');

  document.getElementById('analyzer-results').innerHTML = `
    <div class="result-card">
      <h4>Projection</h4>
      <div class="value">${r.projection} <span class="badge ${compat ? 'badge-ok':'badge-warn'}">${compat ? '✓ Match' : '⚠ Incompatible'}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Confidence: ${r.projection_confidence}</div>
    </div>
    <div class="result-card">
      <h4>Frame Size</h4>
      <div class="value">${r.frame_width_px} × ${r.frame_height_px} px</div>
    </div>
    <div class="result-card">
      <h4>Layout</h4>
      <div class="value">${r.columns} col × ${r.rows} row = ${r.total_frames} frames</div>
    </div>
    <div class="result-card">
      <h4>Animation Rows</h4>
      ${animRows || '<div style="color:var(--muted);font-size:12px">None detected</div>'}
    </div>
    ${r.style_notes || r.compatibility_notes ? `
    <div class="result-card">
      <h4>Notes</h4>
      ${r.style_notes ? `<div style="font-size:12px;margin-bottom:6px">${escHtml(r.style_notes)}</div>` : ''}
      ${r.compatibility_notes ? `<div style="font-size:12px;color:${compat ? 'var(--muted)' : 'var(--red)'}">${escHtml(r.compatibility_notes)}</div>` : ''}
    </div>` : ''}
  `;
}

async function generateMatchingPrompt() {
  const btn = document.getElementById('gen-prompt-btn');
  btn.textContent = 'Generating…'; btn.disabled = true;
  try {
    const r = state.analyzer.analysisResult;
    const messages = [{
      role: 'user',
      content: `Based on this sprite sheet analysis, write a detailed image generation prompt that would produce a matching asset for my game:

Analysis: ${JSON.stringify(r, null, 2)}

${state.settings.gameContext}

Output only the prompt text, no explanation.`
    }];
    const prompt = await callClaude(messages, { maxTokens: 600 });
    state.analyzer.matchingPrompt = prompt;
    const out = document.getElementById('analyzer-prompt-out');
    out.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:11px;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow-y:auto">${escHtml(prompt)}</div>
      <button class="btn" style="width:100%;margin-top:6px" onclick="copyAnalyzerPrompt()">Copy Prompt</button>
    `;
  } catch (e) {
    showError('analyzer-error', e.message);
  } finally {
    btn.textContent = '⬇ Generate Matching Prompt'; btn.disabled = false;
  }
}

function copyAnalyzerPrompt() {
  navigator.clipboard.writeText(state.analyzer.matchingPrompt);
  const btn = event.target;
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy Prompt', 1500);
}
```

- [ ] **Step 4: Open in browser → Sheet Analyzer tab**

Expected: Three-column layout. Left has dashed drop zone (click or drag-and-drop), grid sliders, Analyze button (disabled until file uploaded). Center shows sheet canvas with yellow grid overlay that updates live with sliders. Right shows empty state with icon. Upload a sprite sheet → Analyze → results cards appear showing projection, frame size, layout, animation rows. Grid overlay snaps to detected values. "Generate Matching Prompt" button produces a copyable prompt.

---

## Task 9: Remove Background Feature

**Files:**
- Modify: `~/Downloads/asset-studio.html`

- [ ] **Step 1: Add Remove BG CSS**

```css
/* ── REMOVE BG ── */
.rmbg-popover {
  position: fixed; z-index: 1000; background: var(--bg1);
  border: 1px solid var(--border); border-radius: 10px;
  padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  min-width: 260px;
}
.rmbg-popover h4 { font-size: 13px; font-weight: 600; margin-bottom: 12px; }
.rmbg-preview { display: flex; gap: 12px; align-items: center; margin: 10px 0; }
.rmbg-preview canvas { border: 1px solid var(--border); border-radius: 4px; image-rendering: pixelated; }
.rmbg-controls { display: flex; flex-direction: column; gap: 8px; }
```

- [ ] **Step 2: Add Remove BG HTML (popover, appended to body)**

```html
<!-- Remove BG popover (hidden by default) -->
<div class="rmbg-popover" id="rmbg-popover" style="display:none;top:100px;left:50%;transform:translateX(-50%)">
  <h4>Remove Background</h4>
  <div class="rmbg-preview">
    <div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Before</div>
      <canvas id="rmbg-before" width="80" height="80"></canvas>
    </div>
    <div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">After</div>
      <canvas id="rmbg-after" width="80" height="80"></canvas>
    </div>
  </div>
  <div class="rmbg-controls">
    <div style="display:flex;align-items:center;gap:8px">
      <label style="font-size:12px;color:var(--muted)">Tolerance</label>
      <input type="range" min="10" max="60" value="30" id="rmbg-tolerance"
        oninput="document.getElementById('rmbg-tol-val').textContent=this.value;previewRemoveBG()"
        style="flex:1">
      <span id="rmbg-tol-val" style="font-size:12px;color:var(--muted)">30</span>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-accent" style="flex:1" onclick="applyRemoveBG()">Apply</button>
      <button class="btn" style="flex:1" onclick="closeRemoveBG()">Cancel</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add Remove BG JS**

```javascript
// ── REMOVE BACKGROUND ──
let rmbgTab = null; // 'char' | 'asset'
let rmbgOriginal = null; // base64 of original

function openRemoveBG(tab) {
  rmbgTab = tab;
  rmbgOriginal = tab === 'char' ? state.character.ai.result : state.asset.result;
  if (!rmbgOriginal) return;

  document.getElementById('rmbg-tolerance').value = 30;
  document.getElementById('rmbg-tol-val').textContent = '30';
  drawRmbgBefore();
  previewRemoveBG();
  document.getElementById('rmbg-popover').style.display = 'block';
}

function closeRemoveBG() {
  document.getElementById('rmbg-popover').style.display = 'none';
  rmbgTab = null; rmbgOriginal = null;
}

function drawRmbgBefore() {
  const canvas = document.getElementById('rmbg-before');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => { ctx.clearRect(0,0,80,80); ctx.drawImage(img,0,0,80,80); };
  img.src = rmbgOriginal;
}

function previewRemoveBG() {
  const tolerance = +document.getElementById('rmbg-tolerance').value;
  const before = document.getElementById('rmbg-before');
  const after = document.getElementById('rmbg-after');
  const ctx = before.getContext('2d');
  const imgData = ctx.getImageData(0, 0, 80, 80);
  const result = removeBGFromImageData(imgData, tolerance);
  after.getContext('2d').putImageData(result, 0, 0);
}

function removeBGFromImageData(imageData, tolerance) {
  const data = new Uint8ClampedArray(imageData.data);
  const w = imageData.width, h = imageData.height;
  // Sample corner pixel as background color
  const bgR = data[0], bgG = data[1], bgB = data[2];

  function colorDist(r, g, b) {
    return Math.sqrt((r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2);
  }

  // Flood fill from corners
  const visited = new Uint8Array(w * h);
  const queue = [];
  // Seed from all four corners
  [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].forEach(([x,y]) => queue.push(y*w+x));

  while (queue.length) {
    const idx = queue.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const pi = idx * 4;
    if (colorDist(data[pi], data[pi+1], data[pi+2]) > tolerance) continue;
    data[pi+3] = 0; // transparent
    const x = idx % w, y = Math.floor(idx / w);
    if (x > 0) queue.push(idx-1);
    if (x < w-1) queue.push(idx+1);
    if (y > 0) queue.push(idx-w);
    if (y < h-1) queue.push(idx+w);
  }
  return new ImageData(data, w, h);
}

function applyRemoveBG() {
  const tolerance = +document.getElementById('rmbg-tolerance').value;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    const result = removeBGFromImageData(imgData, tolerance);
    ctx.putImageData(result, 0, 0);
    const b64 = canvas.toDataURL('image/png');
    if (rmbgTab === 'char') {
      state.character.ai.result = b64;
      document.getElementById('char-result-slot').innerHTML = `<img src="${b64}">`;
    } else {
      state.asset.result = b64;
      document.getElementById('asset-result-slot').innerHTML = `<img src="${b64}">`;
    }
    closeRemoveBG();
  };
  img.src = rmbgOriginal;
}
```

- [ ] **Step 4: Open in browser — generate any image → click Remove BG**

Expected: Popover appears with before/after preview. Tolerance slider updates after preview in real time. Apply button replaces result slot image with transparent background version. Cancel closes without changes.

---

## Task 10: Final Polish + Init Wiring

**Files:**
- Modify: `~/Downloads/asset-studio.html`

- [ ] **Step 1: Wire complete DOMContentLoaded**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadHistories();
  initSettings();
  initAssembler();
  initPixelEditor();
  initCharAI();
  initAssetGen();
  startAnimPreview(); // start animation loop after assembler is initialized
});
```

- [ ] **Step 2: Add animation preview loop for Parts Assembler**

```javascript
// Animate the 44×44 preview in Parts Assembler right panel
let animFrame = 0;
let animTimer = null;

function startAnimPreview() {
  if (animTimer) clearInterval(animTimer);
  animTimer = setInterval(() => {
    const canvas = document.getElementById('anim-preview');
    if (!canvas) return;
    // Cycle through the 4 walk frames for the current direction row
    const dirRow = DIR_ROW[state.character.direction] || 0;
    animFrame = (animFrame + 1) % 4;
    const frameIdx = dirRow * 4 + animFrame; // 0–15
    const ctx = canvas.getContext('2d');
    // If the pixel editor has content for this frame, show that; otherwise show assembler composite
    const editorFrame = state.character.frames[frameIdx];
    const hasEditorContent = editorFrame.some(row => row.some(c => c !== null));
    if (hasEditorContent) {
      ctx.clearRect(0, 0, 44, 44);
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          if (editorFrame[y][x]) {
            ctx.fillStyle = editorFrame[y][x];
            ctx.fillRect(x * (44/32), y * (44/32), 44/32, 44/32);
          }
        }
      }
    } else {
      compositeCharacter(ctx, state.character.parts, 44/32, state.character.direction);
    }
  }, 1000 / (state.character.fps || 12));
}
// Start on load
// startAnimPreview() is called inside the unified DOMContentLoaded in Task 10 Step 1.
```

- [ ] **Step 3: Add keyboard shortcut for tab switching**

```javascript
document.addEventListener('keydown', e => {
  // Already handled: Cmd+Z / Cmd+Shift+Z for pixel editor
  // Tab switching: ignore if focus in textarea/input
  if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
});
```

- [ ] **Step 4: Full end-to-end smoke test**

Open `~/Downloads/asset-studio.html` in browser. Verify:

1. **Settings** — Enter Claude key → dot turns green → Test shows "Connected ✓". Enter any image gen key → ImgGen dot turns green. Change service → endpoint updates. Reload → keys persist.
2. **Parts Assembler** — Switch body types, skin tones, hair styles, accessories → canvas updates. Direction buttons change label. Export PNG downloads. "→ AI Generate" switches sub-tab and pre-fills description.
3. **Pixel Editor** — Draw pixels → canvas updates. Undo/redo works. Switch frames in grid → canvas changes. Export Sheet downloads 128×128 PNG.
4. **Character AI Generate** — Enhance button shows "Thinking…" → fills prompt textarea. Generate shows spinner → shows result image. Variations → More generates 4 parallel calls. Tweak chips append text and regen. History persists on reload.
5. **Asset Generator** — Same flow as Character AI Generate. Asset type segmented control changes `state.asset.type`. Oblique note is always visible.
6. **Sheet Analyzer** — Upload sprite sheet → canvas appears with yellow overlay. Sliders update overlay live. Analyze → result cards appear, grid syncs to detected values. Generate Matching Prompt → copyable prompt appears.
7. **Remove BG** — Open from any result → before/after preview. Tolerance slider updates after preview. Apply replaces result image.
8. **Theme** — Toggle between dark and warm-sand → all panels update. Preference persists on reload.
9. **No console errors** in any flow.

- [ ] **Step 5: Verify file is self-contained**

```bash
# Check no external URLs (CDN, fonts, etc.)
grep -n 'https\?://' ~/Downloads/asset-studio.html | grep -v 'api.anthropic.com\|api.stability.ai\|api.openai.com\|api.replicate.com\|localhost'
```

Expected: Zero matches (all API calls are user-configured endpoints, not CDN dependencies).

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-----------------|------|
| Dark + Warm Sand themes, CSS custom properties | Task 1 |
| Topbar with status dots + theme toggle | Task 1 |
| Settings: Claude key, image gen service, endpoint, game context, localStorage | Task 2 |
| API: callClaude(), callImageGen(), error cards | Task 3 |
| Parts Assembler: 4 bodies, 6 skins, 6 hairs, 5 outfits, 4 accessories, canvas compositing | Task 4 |
| Direction strip, frame strip, animation preview, FPS slider | Task 4 |
| "→ AI Generate" export + pre-fill + sub-tab switch | Task 4 |
| Pixel Editor: 32×32 grid, pencil/eraser/fill/eyedropper, undo/redo, 16 frames | Task 5 |
| Character AI Generate: enhance → generate flow, step indicator, variations (4 parallel), history (localStorage) | Task 6 |
| Asset Generator: furniture/floor/prop, enhance → generate, oblique locked | Task 7 |
| Sheet Analyzer: drag-drop upload, grid overlay, Claude vision JSON, result cards | Task 8 |
| Remove BG: canvas flood-fill, corner sampling, tolerance slider 10–60 | Task 9 |
| localStorage history max 20 items | Tasks 6, 7 |
| Empty states, loading spinners, inline error cards | Tasks 6, 7, 8 |
| Export PNG, Copy Sheet | Tasks 4, 5 |

