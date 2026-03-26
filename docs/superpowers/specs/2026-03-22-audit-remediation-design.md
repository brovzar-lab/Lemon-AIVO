# Audit Remediation Design — LEMON AIVO

**Date:** 2026-03-22
**Source:** `docs/audits/2026-03-22-audit.md` (20 findings across 3 tiers)
**Strategy:** Balanced sprints — 5 phases, ordered by dependency, each independently deployable

## Overview

Resolve all 20 audit findings through 5 sequential phases. Each phase mixes categories (a11y, architecture, performance, testing) but is ordered so later phases build on earlier improvements. The first phase unblocks the build pipeline; subsequent phases improve the app's accessibility, architecture, performance, and test coverage in a balanced progression.

### Phase Dependencies

```
Phase 1 (Unblock) → Phase 2 (A11y) → Phase 3 (Architecture) → Phase 4 (Performance) → Phase 5 (Testing)
```

### Scope

- **In scope:** All 15 IMMEDIATELY and LATER audit findings, plus #16 (Lazy-Load Document Libraries) and #20 (CI/CD Pipeline) promoted from SOMEDAY — both directly support Phase 4 bundle targets and Phase 5 quality gates respectively
- **Deferred:** Storybook (#17), visual regression testing (#18), full mobile-first redesign (#19) — these are SOMEDAY items that don't block quality or deployability

### Effort Legend

| Size | Hours | Calendar |
|------|-------|----------|
| S | <4 hours | Half day |
| M | 4–12 hours | 1–2 days |
| L | 2–4 days | 3–5 days |
| XL | 5+ days | 1+ week |

### Risks & Mitigation

1. **Regressions during Phase 3 restructuring:** Phases 2–4 make structural changes before Phase 5 adds tests. Mitigation: run `npm run test` (existing 44 unit tests) after each phase. Perform manual smoke tests (send a message, navigate canvas, open a deal) before merging each phase.
2. **Font size cascade (Phase 2.6):** Changing the base type scale affects all 34 components. Mitigation: visually inspect every panel at 1440px and 1100px widths before merging. If layout breaks, adjust `--panel-width` incrementally.
3. **Phase 3 must preserve Phase 2 a11y attributes:** Component decomposition in Phase 3 restructures the same components that Phase 2 modified. Mitigation: add a checklist item in Phase 3 PRs to verify `aria-*`, `role=`, and heading elements survive the restructuring.
4. **Branch strategy:** Each phase is a separate feature branch off `main`. Merge and deploy each phase before starting the next. No long-lived branches.

---

## Phase 1: Unblock (Build + Crash Protection)

**Goal:** Get `npm run build` working and prevent component crashes from killing the entire app.

**Why first:** Nothing else matters if you can't build. Every subsequent phase depends on a working build and the safety net of error boundaries.

| # | Task | Effort | Audit Item | Files |
|---|------|--------|------------|-------|
| 1.1 | Fix 80+ TypeScript errors so `npm run build` passes | M | #6 | Multiple across `src/` — run `npm run typecheck` to enumerate |
| 1.2 | Add React error boundaries around major layout sections | S | #1 | New `src/components/ui/ErrorBoundary.tsx`, modify `src/App.tsx` |

### 1.1 Fix TypeScript Build Errors

- Run `npm run typecheck`, collect all errors
- Group by root cause (missing types, incorrect generics, unused imports, strict-null violations)
- Fix in dependency order — type definitions first, then consumers
- Do not suppress errors with `any` or `@ts-ignore` — fix the actual types

### 1.2 Add Error Boundaries

- Create a reusable `ErrorBoundary` component with:
  - Fallback UI showing "Something went wrong" with a retry button
  - `componentDidCatch` logging for debugging
  - Styled consistently with the pixel design system
  - **Note:** The existing `ErrorBanner` component handles API/chat errors (transient, dismissible). `ErrorBoundary` handles component crashes (fatal, requires retry/reload). They serve different purposes and should not be merged. `ErrorBoundary` fallback UI should be visually consistent with `ErrorBanner` styling but functionally independent.
- Wrap 3 independent zones in `App.tsx`:
  - `<ErrorBoundary>` around `<LeftPanel />`
  - `<ErrorBoundary>` around the center column (AgentBar + OfficeCanvas + EditorToolbar)
  - `<ErrorBoundary>` around `<RightPanel />`
- Add a granular boundary inside `ChatPanel` around the message rendering area

### Acceptance Criteria

- `npm run build` exits 0
- `npm run typecheck` exits 0
- An error thrown inside ChatPanel renders fallback UI — other panels remain functional
- An error thrown inside OfficeCanvas renders fallback UI — chat remains functional

---

## Phase 2: Accessibility & Contrast

**Goal:** Eliminate all WCAG AA violations and make the app navigable by keyboard and screen reader.

**Why second:** Accessibility violations carry legal risk (ADA/WCAG compliance) and affect real users now. These fixes are mostly additive and low-risk.

| # | Task | Effort | Audit Item | Files |
|---|------|--------|------------|-------|
| 2.1 | Fix 2 color contrast failures | S | #5 | `src/components/LeftPanel.tsx`, `src/components/AgentBar.tsx` |
| 2.2 | Add global `:focus-visible` outline style | S | #3 | `src/pixelDesignSystem.css` |
| 2.3 | Add ARIA roles to custom interactive elements | M | #3 | Agent chips, deal cards, chat tabs — all clickable `<div>` elements |
| 2.4 | Add landmark structure | S | #4, #5 | `src/App.tsx`, `src/components/LeftPanel.tsx`, `src/components/RightPanel.tsx` |
| 2.5 | Convert title divs to semantic headings | S | #4 | Panel and section headers across all panels |
| 2.6 | Increase base font size 12px → 14px+ | M-L | #2 | `src/pixelDesignSystem.css` `:root` type scale — cascade affects all 34 components, requires visual verification |

### 2.1 Color Contrast Fixes

- "1 open" badge in Active Deals header: foreground `#8a4a3a` on `#14132a` = 2.69:1. Change to `--accent-coral` (#c06050) or lighter variant to achieve 4.5:1
- Agent name "Patrik" in agent bar: `#8b5cf6` on `#14132a` = 4.28:1. Lighten to `#a78bfa` or similar for 4.5:1
- Manually verify the 9 "incomplete" elements flagged by axe-core (text shadows, gradients)

### 2.2 Focus-Visible Styles

Add to `pixelDesignSystem.css`:
```css
*:focus-visible {
  outline: 2px solid var(--accent-teal);
  outline-offset: 2px;
}
```
Ensure no `outline: none` declarations override this on interactive elements.

### 2.3 ARIA Roles

For every clickable `<div>` that isn't a native `<button>` or `<a>`:
- Add `role="button"`
- Add `tabindex="0"`
- Add `onKeyDown` handler that triggers click on Enter/Space
- Add `aria-label` if the element has no visible text (icon-only buttons: chat send, close buttons, zoom controls)

Affected components: AgentBar (agent chips), DealCard (card click), ChatPanel (chat tabs), ZoomControls (zoom buttons), EditorToolbar (tool buttons).

Prefer converting to native `<button>` elements where possible — this eliminates the need for role/tabindex/keyboard handlers.

### 2.4 Landmark Structure

- Wrap the top bar ("LEMON STUDIOS" + "ONLINE") in `<header role="banner">`
- Add `aria-label="Deals and Activity"` to the left `<aside>`
- Add `aria-label="Chat and Collaboration"` to the right `<aside>`
- The center column already has `<main>` — verify or add

### 2.5 Semantic Headings

- Make "LEMON STUDIOS" an `<h1>` (can keep existing visual styling)
- Convert `.panel-title` divs to `<h2>` in each panel
- Convert `.section-title` divs to `<h3>` within panel sections
- Verify heading order doesn't skip levels

### 2.6 Font Size Adjustment

Update `:root` type scale tokens:
- `--text-xs: 10px` (was 9px)
- `--text-sm: 12px` (was 10px)
- `--text-base: 14px` (was 12px)
- `--text-md: 16px` (was 14px)
- `--text-lg: 18px` (was 16px)
- `--text-xl: 22px` (was 20px)
- Pixel font sizes (`--pixel-xs`, `--pixel-sm`, `--pixel-md`) remain unchanged — they're decorative

After adjustment, visually verify all panels still fit without overflow. The `--panel-width` (270px) may need a slight bump.

### Acceptance Criteria

- axe-core scan returns 0 violations (currently 4)
- axe-core "incomplete" items reduced to 0, or each remaining incomplete item documented with rationale for acceptance
- Tab key navigates all interactive elements with visible focus ring
- Screen reader (VoiceOver) announces: landmarks, headings, button labels
- No body text renders below 14px (pixel-font decorative headings exempt)
- All panels fit without overflow at both 1440px and 1100px widths after font size changes

---

## Phase 3: Architecture & Design System

**Goal:** Reduce component complexity, eliminate circular dependencies, and begin migrating from inline styles to the design system.

**Why third:** Architecture improvements must happen before performance work (Phase 4) because code-splitting is far easier on smaller, well-separated components. Design system migration reduces the surface area for future styling bugs.

| # | Task | Effort | Audit Item | Files |
|---|------|--------|------------|-------|
| 3.1 | Break up EditorToolbar.tsx (1,416 LOC) | L | #7 | `src/components/canvas/EditorToolbar.tsx` → 4-5 sub-components |
| 3.2 | Decouple god components (Header, ChatPanel) from 5 stores each | M | #15 | `src/components/ui/Header.tsx`, `src/components/chat/ChatPanel.tsx` |
| 3.3 | Resolve chatStore ↔ dealStore circular dependency | M | #13 | `src/store/chatStore.ts`, `src/store/dealStore.ts` |
| 3.4 | Migrate inline styles to CSS classes (top 6 files) | L | #9 | EditorToolbar (93), ChatPanel (22), CollaborationPanel (22), CollabHistoryList (21), DealActions (20), DealSidebar (19) |
| 3.5 | Replace raw hex/px values with design tokens | M | #9 | 48 raw hex values across 8 files, 230 raw px values across 30 files |

### 3.1 EditorToolbar Decomposition

Extract from the 1,416 LOC monolith into:
- `EditorToolbar.tsx` — shell/layout only (~100 LOC)
- `ToolPalette.tsx` — tool selection buttons and active tool state
- `LayerPanel.tsx` — layer list, visibility toggles, reordering
- `PropertyPanel.tsx` — property editing for selected furniture/tile
- `ToolbarHeader.tsx` — mode switching, save/load controls

Each sub-component:
- Owns its own store subscriptions (no prop-drilling from parent)
- Is wrapped in `React.memo` where appropriate
- Has its own CSS classes in `pixelDesignSystem.css`

### 3.2 God Component Decoupling

**Header.tsx** (5 stores → 1 custom hook):
- Create `useHeaderState()` hook that selects only the needed slices from officeStore, dealStore, fileStore, memoryStore, audioStore
- Header imports only the hook, not 5 stores directly

**ChatPanel.tsx** (5 stores → 1-2 custom hooks + structural split):
- Create `useChatContext()` hook for chat-specific state
- Consider splitting into: `ChatPanel` (shell), `ChatToolbar` (agent/deal selectors), `ChatStatusBar` (token counter, streaming state)

### 3.3 Circular Dependency Resolution

`chatStore` imports `dealStore` and `dealStore` imports `chatStore`.

**Approach:** Extract shared logic into `src/services/dealChatBridge.ts`. Both stores import the bridge; neither imports the other. This is the cleanest solution — it makes the dependency explicit in a single service file rather than scattered across stores.

Fallback only if the bridge approach proves infeasible: use lazy `getState()` calls at runtime instead of static imports.

### 3.4–3.5 Design System Migration

For each file being touched:
- Replace `style={{ color: '#8a8a9a' }}` with `className="text-secondary"` (add class to CSS if missing)
- Replace `style={{ padding: '8px' }}` with `className` using `--space-2` token
- Replace `style={{ fontFamily: "'Press Start 2P'" }}` with `className` using `--font-pixel`
- Track compliance ratio: target <1:1 inline:className in touched files

### Acceptance Criteria

- No component **touched in Phase 3** exceeds 400 LOC (EditorToolbar sub-components, ChatPanel split, Header). Other 200+ LOC components (PersonaBuilderChat 294, CollaborationPanel 286, LeftPanel 237, CollabHistoryList 221, HopApprovalModal 214, ChatInput 214) are not in scope — address opportunistically or in a future cycle
- No component imports more than 3 stores directly
- No circular dependencies between stores (`madge --circular src/store/`)
- Inline:className ratio <1:1 in the 6 migrated files. The remaining 27 files with inline styles are addressed opportunistically when touched in other phases — not a blocker for Phase 3 completion
- Zero raw hex values in migrated files
- All `aria-*`, `role=`, and heading elements from Phase 2 survive component decomposition (verify via axe-core re-run)

---

## Phase 4: Performance

**Goal:** Reduce the 5 MB monolithic JS bundle to <500 KB gzipped initial load.

**Why fourth:** Code-splitting benefits from the clean component boundaries established in Phase 3. Tree-shaking and lazy loading are mechanical changes that are lower-risk after architecture is solid.

| # | Task | Effort | Audit Item | Files |
|---|------|--------|------------|-------|
| 4.1 | Code-split via React.lazy + Suspense | L | #8 | `src/App.tsx`, feature entry points, `vite.config.ts` |
| 4.2 | Tree-shake date-fns/locale (897 KB → ~20 KB) | S | #8 | All files importing from `date-fns` |
| 4.3 | Tree-shake lucide-react (795 KB → ~50 KB) | S | #8 | All files importing icons |
| 4.4 | Lazy-load pdfjs-dist, xlsx, mammoth (~1.2 MB) | M | #16 | `src/components/FileViewer.tsx`, `src/components/files/FileCabinetModal.tsx` |
| 4.5 | Dynamic import firebase/firestore (787 KB) | M | #8 | Firebase initialization code |
| 4.6 | Remove axe-core from production | S | #8 | CDN script tag or import |

### 4.1 Code Splitting Strategy

Create lazy-loaded route/feature boundaries:
```
Initial chunk: App shell, AgentBar, OfficeCanvas (core experience)
Lazy chunks:
  - ChatPanel + message components
  - EditorToolbar + sub-components (from Phase 3 split)
  - PersonaBuilderOverlay + chat + sidebar
  - FileCabinetModal + FileViewer
  - CollaborationPanel + sub-components
  - DealSidebar + CreateDealForm + DealActions
```

Each lazy chunk gets a `<Suspense fallback={<LoadingSpinner />}>` wrapper.

Configure Vite's `build.rollupOptions.output.manualChunks` if automatic splitting doesn't produce optimal chunks.

### 4.2–4.3 Tree-Shaking

**date-fns:** Replace `import { format } from 'date-fns'` with direct subpath imports. Remove the full locale bundle — import only `date-fns/locale/es` if Spanish is needed.

**lucide-react:** Verify the correct deep-import path for the installed version (e.g., `import { Search } from 'lucide-react'` may already tree-shake with proper Vite config). If not, use per-icon imports or configure `vite.config.ts` `optimizeDeps.include` to enable tree-shaking. Check actual bundle impact with `npx vite-bundle-visualizer` before and after.

### 4.4 Lazy Document Libraries

Wrap document processing in dynamic imports:
```typescript
const loadPdfWorker = () => import('pdfjs-dist/build/pdf.worker.min.mjs');
const loadXlsx = () => import('xlsx');
const loadMammoth = () => import('mammoth');
```
Only called when user opens FileViewer or FileCabinetModal.

### Acceptance Criteria

- Main JS chunk <500 KB gzipped (currently 786 KB)
- Initial page load does not fetch pdfjs-dist, xlsx, mammoth, or axe-core
- `npm run build` output shows multiple chunks (not 1 monolithic file)
- Lighthouse Performance score >80

---

## Phase 5: Testing & Polish

**Goal:** Establish test coverage, add memoization for render performance, introduce responsive breakpoints, and set up CI.

**Why last:** Tests should cover the final architecture (after Phase 3 restructuring). Responsive breakpoints and memoization are polish that benefits from stable components.

| # | Task | Effort | Audit Item | Files |
|---|------|--------|------------|-------|
| 5.1 | Add component tests for top 5 untested components | L | #11 | ChatPanel, ChatInput, AgentBar, DealCard, CollaborationPanel |
| 5.2 | Write 5 Playwright e2e specs | L | #12 | New test directory |
| 5.3 | Add memoization to list-rendered components | M | #14 | AgentBar chips, DealCard, MessageBubble, CollabHistoryList items |
| 5.4 | Add responsive breakpoints (768px, 480px) | L | #10 | `src/pixelDesignSystem.css`, layout components |
| 5.5 | Set up CI pipeline | M | #20 | New `.github/workflows/ci.yml` |

### 5.1 Component Tests

Use `@testing-library/react` — test user behavior, not implementation:
- **ChatPanel:** renders messages, switches agents, shows streaming indicator
- **ChatInput:** submits on Enter, disables during streaming, shows token count
- **AgentBar:** selects agent on click, shows status indicators, highlights active
- **DealCard:** displays deal info, handles click, shows progress bar
- **CollaborationPanel:** lists active collaborations, shows live indicators

Complete the existing `DealCard.test.tsx` todo stubs.

### 5.2 E2E Tests

5 critical user flows:
1. Select agent → type message → see response appear
2. Create deal → see it in deals list → assign agent
3. Click room in canvas → room label appears → agent bar updates
4. Upload file → see it in file cabinet → open viewer
5. Start collaboration → see progress → view summary

### 5.3 Memoization

- Wrap `AgentChip`, `DealCard`, `MessageBubble`, `CollabCard` in `React.memo`
- Add `useMemo` for expensive derived state in ChatPanel (filtered messages), CollaborationPanel (sorted collabs)
- Add `useCallback` for event handlers passed as props from parent to child

### 5.4 Responsive Breakpoints

Add to `pixelDesignSystem.css`:
```css
@media (max-width: 768px) {
  /* Collapse to 2-column: hide left panel, show toggle button */
  .panel-left { display: none; }
  .panel-left.open { display: flex; position: fixed; z-index: 50; }
  :root { --panel-width: 260px; }
}

@media (max-width: 480px) {
  /* Single column: tab-based navigation */
  .panel-right { display: none; }
  .panel-right.open { display: flex; position: fixed; z-index: 50; }
  .canvas-wrap { min-height: 300px; }
}
```
Add toggle buttons for showing/hiding panels on smaller viewports. Ensure touch targets are 44x44px minimum.

### 5.5 CI Pipeline

GitHub Actions workflow:
- **On PR:** `npm run lint` → `npm run typecheck` → `npm run test` → `npm run build`
- **Optional:** Playwright e2e on Chrome
- Block merge on failure

### Acceptance Criteria

- Component test coverage reaches ~24% (8/34 components tested: 3 existing + 5 new). Further expansion toward 50%+ is a future cycle goal
- 5 e2e flows pass in Playwright
- All list-rendered components are memoized
- Layout doesn't overflow or break at 768px and 480px widths
- CI runs on every PR and blocks broken code

---

## Deferred (SOMEDAY)

These items are tracked but not scheduled:
- **#17** Component Library / Storybook
- **#18** Visual regression testing
- **#19** Full mobile-first redesign (Phase 5.4 adds basic responsiveness; a full redesign is a separate initiative)

---

## Summary

| Phase | Focus | Items | Combined Effort | Est. Calendar |
|-------|-------|-------|-----------------|---------------|
| 1 | Unblock | 2 | S-M | 1–2 days |
| 2 | Accessibility | 6 | M-L | 3–5 days |
| 3 | Architecture | 5 | L | 5–8 days |
| 4 | Performance | 6 | M-L | 3–5 days |
| 5 | Testing & Polish | 5 | L-XL | 5–8 days |
| **Total** | | **24 tasks** | | **~3–4 weeks** |
