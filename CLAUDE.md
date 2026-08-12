# LEMON AIVO

Multi-agent AI workspace: 6 AI personas (department heads at Lemon Studios, a CDMX entertainment company) occupy rooms in a pixel-art isometric office. The user navigates as "Billy," chats with agents, manages deals/projects, runs War Room multi-agent discussions, uploads docs for analysis, and edits the office layout. Single-page app with a custom Canvas 2D game engine rendering the office alongside React UI panels.

Stack: React 19 + TypeScript 5.7 + Vite 6 + Zustand 5. Deployed via Firebase Hosting (project `lemon-aivo`, serves `dist/`).

## Commands

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server | `npm run dev -- --port 5202` (see port gotcha below) |
| Build | `npm run build` (`tsc -b && vite build`) |
| Typecheck only | `npm run typecheck` (`tsc -b --noEmit`) |
| Lint / autofix | `npm run lint` / `npm run lint:fix` (ESLint over `src/`) |
| Format | `npm run format` (Prettier over `src/**/*.{ts,tsx,css}`) |
| Unit tests | `npm run test` (Vitest, run mode) |
| E2E tests | `npm run test:e2e` (Playwright — but see gotcha: no config/specs yet) |

## Architecture

```
src/
├── App.tsx              # Root — three panels: LeftPanel + OfficeCanvas + RightPanel
├── main.tsx             # Entry — mounts <App/> into #root
├── pixelDesignSystem.css # ALL design tokens + component styles (~1400 lines)
├── components/          # React UI grouped by feature domain
│   ├── canvas/ chat/ collaboration/ deal/ files/ memory/
│   ├── persona-builder/ ui/
│   ├── AgentBar.tsx LeftPanel.tsx RightPanel.tsx FileViewer.tsx
├── engine/              # Custom Canvas 2D game engine (~30 modules)
│   ├── renderer.ts      # 6-layer draw pipeline (floor→walls→y-sorted→glow→overlays)
│   ├── gameLoop.ts      # rAF loop; reads stores via getState() (non-reactive)
│   ├── camera.ts characters.ts input.ts officeLayout.ts depthSort.ts
│   ├── audioManager.ts pixelScene.ts pixelSprites.ts rpgmakerImport.ts
│   └── furniture48Catalog.ts  # 26k lines / 3.2MB — NEVER read in full
├── store/               # 10 Zustand stores by domain
│   ├── chatStore officeStore editorStore collaborationStore
│   ├── dealStore fileStore memoryStore audioStore
│   └── activityStore personaBuilderStore
├── services/
│   ├── anthropic/       # client.ts, stream.ts, retryBackoff.ts
│   ├── collaboration/   # chainRunner, chainTemplates, safetyLimits, contextBridge
│   ├── context/         # builder, summarizer, tokenCounter, warRoomSummary
│   ├── files/           # extractPdf/Docx/Excel + fileService
│   ├── persistence/     # indexeddb adapter + migration + clearData
│   ├── actions/ memory/ personaBuilderService.ts
│   └── simulation.ts    # no-op stub (was fake activity generator)
├── hooks/               # useChat, useCollaboration, useWarRoom
├── config/agents/       # 6 personas: patrik(CFO) marcos sandra isaac wendy charlie
├── config/prompts/      # base system prompt template
└── types/               # TS type defs (agent, chat, deal, file, memory, ...)
```

## Key Files

- `vite.config.ts` — Vite config + the `/api/anthropic` proxy that injects the API key server-side. Server port hardcoded to `5173` here (override on CLI, see gotcha). Custom `loadDotenv()` overlays `.env` so file values win over empty shell vars.
- `vite-plugin-persona-writer.ts` — custom Vite plugin adding a dev `POST /api/persona/save` endpoint for the persona builder.
- `firebase.json` / `.firebaserc` — Firebase Hosting; public dir `dist`, SPA rewrite to `/index.html`, project `lemon-aivo`.
- `.github/workflows/` — `ci.yml` (lint→build→test on PRs to `main`), `deploy.yml` (same, then Firebase deploy on push to `main`). Both run on Node 22.
- `eslint.config.js` — ESLint v9 flat config (not `.eslintrc`).

## Environment

- `ANTHROPIC_API_KEY` — required, in `.env` (value starts with `sk-ant-`). Proxied server-side; never in the client bundle. Copy `.env.example` → `.env` and fill it in.

## Gotchas

- **Port collision**: `vite.config.ts` hardcodes port **5173**, but BATEMAN owns 5173 in the fleet. LEMON-AIVO's assigned port is **5202** — always run `npm run dev -- --port 5202`. A bare `npm run dev` starts on 5173 and can collide. (`strictPort` is off, so the CLI flag wins.)
- **API proxy, not client env**: Vite dev proxies `/api/anthropic` → `api.anthropic.com`, rewrites the path, and injects `x-api-key` + `anthropic-version` from `.env`. The SDK client (`services/anthropic/client.ts`) uses `baseURL: window.location.origin + '/api/anthropic'`, a placeholder `apiKey`, and `dangerouslyAllowBrowser: true` (safe — the real key is never in the bundle). NEVER reference `import.meta.env.ANTHROPIC_API_KEY` in client code.
- **E2E is scaffolded but empty**: `test:e2e` runs `playwright test`, but there is **no `playwright.config.*` and no `*.spec.ts` files** yet — the command currently finds nothing to run. Add config + specs before relying on it. Real coverage is the ~46 Vitest unit tests.
- **Deploy is automatic**: push/merge to `main` triggers `deploy.yml` → Firebase Hosting via `w9jds/firebase-action` (needs `FIREBASE_TOKEN` secret). Active branches include `RPG-maker` (current), `functionality`, `main`.
- **Never read `src/engine/furniture48Catalog.ts` in full** (26k lines / 3.2MB) — grep for specific entries.
- **`dist/` is ~350MB** (sprite assets) — do not commit raw sprites; only optimized.
- **Game loop ↔ store bridge**: the engine reads stores via `getState()` every frame (non-reactive); React subscribes reactively. Only update Zustand stores on meaningful state changes — per-frame data (animation, interpolation) lives in engine objects, not stores. Don't block the rAF loop with synchronous heavy work.
- **TS strict**: `tsconfig.app.json` sets `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, and `strict` — all hard `tsc` errors. Run `npm run typecheck` before claiming a fix compiles. (ESLint `no-unused-vars` is only a `warn`, so lint passing does not mean the build passes.)
- **Tailwind is installed but UNUSED**: `tailwindcss` + `@tailwindcss/vite` are in devDependencies, but the plugin is not loaded in `vite.config.ts` and no `@tailwind` directives exist. All styling is in `pixelDesignSystem.css`. Do not add Tailwind usage.
- **Collaboration chains**: `services/collaboration/chainRunner.ts` orchestrates multi-agent runs with `safetyLimits.ts` and `chainTemplates.ts`. Changing chain logic can break the hop-approval flow (`components/collaboration/HopApprovalModal.tsx`).
- **Agentation**: `App.tsx` renders `<Agentation/>` (visual annotation tool from the `agentation` npm dep) only when `import.meta.env.DEV`. Also wired as an MCP server in `.mcp.json` (`agentation-mcp`).
- **Scripts side**: `scripts/` has TS asset generators (`generateSprites.ts`, `generateAudio.ts`, `generateFurnitureCatalog.ts`), Python utilities (`requirements.txt`: python-dotenv, requests), and RPG Maker map import (`scripts/rpgmaker-import-cli.ts` + `scripts/patch-rpgmaker-map.js`).

## Code Style

- Design tokens: use CSS custom properties from `pixelDesignSystem.css` (`--bg-*`, `--text-*`, `--accent-*`, `--font-*`), not raw hex/px.
- Fonts: Press Start 2P (pixel headings, `--font-pixel`), Inter (body, `--font-ui`).
- Global flat CSS with semantic class names in `pixelDesignSystem.css` — no CSS Modules, no Tailwind. Legacy files carry heavy inline styles; prefer migrating to CSS classes when you touch a file.
- Imports from `src/` use the `@/` path alias.
- Prettier: semi, singleQuote, trailingComma "all", printWidth 100, tabWidth 2.
- New components → the matching feature folder under `src/components/`; new stores → `src/store/`; new service logic → `src/services/`.

## Testing

- Vitest + jsdom + @testing-library/react; canvas/engine tests use `vitest-canvas-mock` (`vitest.config.ts` setupFiles).
- Test files co-located in `__tests__/` dirs as `*.test.{ts,tsx}` (~46 files). Setup: `src/test-setup.ts` (jest-dom matchers, cleanup after each).
- E2E: Playwright is a dependency but not yet configured (see gotcha).
