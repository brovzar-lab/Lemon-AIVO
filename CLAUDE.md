# LEMON AIVO

Multi-agent AI workspace where 6 AI personas (each a department head at Lemon Studios, a Mexico City entertainment company) occupy rooms in a pixel-art isometric office. Users navigate as "Billy," chat with agents, manage deals/projects, run War Room multi-agent discussions, upload documents for analysis, and edit the office layout. Built as a single-page app with a custom 2D game engine rendering the office alongside React UI panels.

## Architecture

- React 19 + TypeScript 5.7 + Vite 6 + Zustand 5
- Custom 2D game engine (Canvas API) with 6-layer rendering pipeline in `src/engine/`
- 10 Zustand stores scoped by domain in `src/store/`
- 6 AI agent personas in `src/config/agents/`: Patrik (CFO), Marcos, Sandra, Isaac, Wendy, Charlie
- Anthropic Claude API proxied through Vite dev server (`/api/anthropic`) — key injected server-side, never in client bundle
- Data persisted to IndexedDB via `idb` library
- Path alias: `@/` → `src/`
- Deployed via Firebase Hosting (`dist/` directory)

### Directory Structure

```
src/
├── App.tsx              # Root component — two-column layout (LeftPanel + OfficeCanvas)
├── main.tsx             # Entry point — mounts <App /> into #root
├── index.css            # Imports pixelDesignSystem.css + highlight.js theme
├── pixelDesignSystem.css # All design tokens and component styles (1300+ lines)
├── components/          # React UI grouped by feature domain
│   ├── canvas/          # OfficeCanvas, EditorToolbar, RoomLabel, ZoomControls
│   ├── chat/            # ChatPanel, ChatInput, MessageBubble, WarRoom*, TokenCounter
│   ├── collaboration/   # CollaborationPanel, HopApprovalModal, CollabSummaryView
│   ├── deal/            # DealCard, DealSidebar, CreateDealForm, DealActions
│   ├── files/           # FileCabinetModal
│   ├── memory/          # MemoryPanel
│   ├── persona-builder/ # PersonaBuilderOverlay, PersonaBuilderChat, PersonaFieldsSidebar
│   ├── ui/              # Header, ErrorBoundary
│   ├── AgentBar.tsx     # Agent selector bar
│   ├── LeftPanel.tsx    # Left sidebar (chat + projects)
│   ├── RightPanel.tsx   # Right sidebar (deal details)
│   └── FileViewer.tsx   # Document viewer overlay
├── engine/              # Custom 2D game engine (Canvas API)
│   ├── renderer.ts      # 6-layer rendering pipeline (floor → walls → furniture → glow → UI)
│   ├── gameLoop.ts      # requestAnimationFrame loop, reads stores via getState()
│   ├── camera.ts        # Pan/zoom camera with auto-fit
│   ├── characters.ts    # Character movement, pathfinding, animation
│   ├── input.ts         # Mouse/keyboard input handling, drag-and-drop
│   ├── officeLayout.ts  # Room definitions, furniture placement, tile data
│   ├── audioManager.ts  # Ambient music + SFX system
│   ├── pixelScene.ts    # Pixel-art scene composition
│   ├── pixelSprites.ts  # Sprite rendering for pixel characters
│   ├── furniture48Catalog.ts  # ⚠️ 3.3MB — DO NOT read full file
│   └── ...              # depthSort, glowEffects, tileMap, zoomController, etc.
├── store/               # 10 Zustand stores
│   ├── chatStore.ts     # Conversations, streaming state, War Room
│   ├── officeStore.ts   # Rooms, camera, Billy position, agent statuses
│   ├── editorStore.ts   # Layout editor tools, undo/redo
│   ├── collaborationStore.ts  # Multi-agent collaboration chains
│   ├── dealStore.ts     # Deal/project management
│   ├── fileStore.ts     # Uploaded documents (PDF, DOCX, XLSX)
│   ├── memoryStore.ts   # Agent memory/facts
│   ├── audioStore.ts    # Ambient/SFX mute state
│   ├── activityStore.ts # Activity log
│   └── personaBuilderStore.ts # Persona creation wizard
├── services/            # Business logic, external integrations
│   ├── anthropic/       # Claude API client, streaming, retry/backoff
│   ├── collaboration/   # Chain runner, templates, context bridge, safety limits
│   ├── context/         # Prompt builder, summarizer, token counter
│   ├── files/           # PDF/DOCX/Excel text extraction
│   ├── persistence/     # IndexedDB adapter, migration, data cleanup
│   ├── actions/         # Deal action parser
│   ├── memory/          # Memory service
│   └── simulation.ts    # Disabled — was fake activity generator
├── hooks/               # React hooks
│   ├── useChat.ts       # Chat send/stream logic
│   ├── useCollaboration.ts  # Collaboration orchestration
│   └── useWarRoom.ts    # War Room multi-agent streaming
├── config/
│   ├── agents/          # 6 persona definitions (name, title, color, systemPrompt)
│   └── prompts/         # Base system prompt template
└── types/               # TypeScript type definitions (agent, chat, deal, file, etc.)
```

### Key Patterns

- **Game loop ↔ React bridge**: The engine reads stores via `getState()` (non-reactive, every frame). React components subscribe reactively. Only update stores on meaningful state changes, not every frame.
- **API proxy**: Vite dev server proxies `/api/anthropic` → `https://api.anthropic.com`, injecting the API key from `.env` server-side. The Anthropic SDK client uses `baseURL: '/api/anthropic'` with a dummy key.
- **Streaming**: Claude responses stream via the Anthropic SDK's streaming API. Chat, War Room, and collaboration each have distinct streaming patterns.
- **File processing**: Supports PDF (pdfjs-dist), DOCX (mammoth), and Excel (xlsx) — extracted text goes into agent context.

## Setup

```bash
npm install
cp .env.example .env   # Add your ANTHROPIC_API_KEY
npm run dev             # http://localhost:5173
```

### Environment Variables

- `ANTHROPIC_API_KEY` — Required. Anthropic API key (starts with `sk-ant-`). Stored in `.env`, proxied server-side.

## Commands

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — `tsc -b && vite build`
- `npm run preview` — preview production build
- `npm run typecheck` — `tsc -b --noEmit`
- `npm run lint` / `npm run lint:fix` — ESLint (v9 flat config)
- `npm run format` — Prettier (semi, singleQuote, printWidth 100)
- `npm run test` — Vitest unit tests
- `npm run test:e2e` — Playwright e2e tests

## Code Style

- **Design tokens**: All in `src/pixelDesignSystem.css` — use CSS custom properties (`--bg-*`, `--text-*`, `--accent-*`, `--font-*`), not raw hex/px values
- **Fonts**: Press Start 2P (pixel headings via `--font-pixel`), Inter (body text via `--font-ui`)
- **CSS approach**: Global flat CSS with semantic class names in `pixelDesignSystem.css`. No CSS Modules. No Tailwind utility classes (Tailwind is in devDependencies but unused — do not add Tailwind usage).
- **Inline styles**: Legacy codebase has heavy inline styles. Prefer migrating to CSS classes in `pixelDesignSystem.css` when touching a file.
- **Prettier**: semi, singleQuote, trailingComma "all", printWidth 100, tabWidth 2

## Testing

- Unit tests: Vitest + jsdom + @testing-library/react
- Canvas/engine tests: `vitest-canvas-mock` (configured in `vitest.config.ts`)
- E2e tests: Playwright (chromium)
- Test files: `src/**/*.test.{ts,tsx}` — co-located in `__tests__/` directories
- Test setup: `src/test-setup.ts` — imports jest-dom matchers, runs cleanup after each test
- ~45 test files across engine, store, services, and components

## Gotchas

- `src/engine/furniture48Catalog.ts` is 3.3MB / 26k lines — **never read the full file**. Use grep to find specific entries.
- `dist/` is ~350MB due to sprite assets — never commit raw sprites, only optimized
- ESLint v9 flat config (`eslint.config.js`) — not legacy `.eslintrc` format
- TypeScript strict mode: `noUnusedLocals` and `noUnusedParameters` are **errors** (not warnings). ESLint separately warns on `@typescript-eslint/no-unused-vars` with `_` prefix exemption.
- API key in `.env` is proxied server-side — never reference `import.meta.env.ANTHROPIC_API_KEY` in client code
- `Tailwind CSS` packages are in `devDependencies` but **not configured or used** — the Vite plugin is not loaded. All styling is in `pixelDesignSystem.css`.
- `src/services/simulation.ts` is a no-op stub — real events drive activity, not simulated ones
- `vite-plugin-persona-writer.ts` is a custom Vite plugin that adds a `/api/save-persona` endpoint for the persona builder
- The `Agentation` package (devDependency) is imported in `App.tsx`
- `EditorToolbar.tsx` is ~48KB — large file, imports from the furniture catalog

## Fragile Areas

- **Game loop timing**: The `requestAnimationFrame` loop in `gameLoop.ts` must not be blocked. Avoid synchronous heavy work in engine code.
- **Store update frequency**: Only update Zustand stores on meaningful state changes. Per-frame data (animation frames, interpolation) lives in engine objects, not stores.
- **Sprite loading**: Sprites load asynchronously. The renderer handles missing sprites gracefully with placeholder colors, but race conditions in sprite sheet loading can cause visual glitches.
- **Collaboration chains**: `chainRunner.ts` orchestrates multi-agent conversations with safety limits (`safetyLimits.ts`). Modifying chain logic can break the hop approval flow.

## AI Rules

### Never
- Read `src/engine/furniture48Catalog.ts` in full
- Expose `ANTHROPIC_API_KEY` in client-side code
- Add Tailwind utility classes (the project uses custom CSS)
- Commit sprite assets or the `dist/` directory
- Update stores every frame from the game loop — only on meaningful state changes
- Add `@tailwind` directives or configure the Tailwind Vite plugin

### Always
- Use `@/` path alias for imports from `src/`
- Use CSS custom properties from `pixelDesignSystem.css` for colors, fonts, spacing
- Place new components in the appropriate feature domain folder under `src/components/`
- Place new stores in `src/store/`, new service logic in `src/services/`
- Run `npm run typecheck` before claiming a fix compiles
- Match existing Prettier config (semi, singleQuote, printWidth 100)
