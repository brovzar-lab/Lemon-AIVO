# Phase 1: Unblock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 119 TypeScript build errors so `npm run build` passes, and add error boundaries so component crashes don't kill the app.

**Architecture:** Two independent workstreams — (1) fix TS errors grouped by error category across 19 files, (2) create a reusable ErrorBoundary component and wrap the 3 main layout zones. The ErrorBoundary is a class component (React error boundaries require `componentDidCatch`), styled with the existing pixel design system.

**Tech Stack:** TypeScript 5.7 strict mode, React 19, Zustand 5, Vite 6

**Spec:** `docs/superpowers/specs/2026-03-22-audit-remediation-design.md` (Phase 1)

---

## File Structure

Exact error distribution per file (verified via `npm run build` output):

### Task 2 — Unused vars/imports (TS6133 + TS6192 + TS2578 = 27 errors)
| File | Errors |
|------|--------|
| `src/engine/renderer.ts` | 8 TS6133 |
| `src/components/canvas/EditorToolbar.tsx` | 3 TS6133 |
| `src/engine/depthSort.ts` | 2 TS6133 + 1 TS6192 |
| `src/engine/editorInput.ts` | 1 TS6133 |
| `src/hooks/useCollaboration.ts` | 1 TS6133 |
| `src/engine/__tests__/input.test.ts` | 3 TS6133 |
| `src/engine/__tests__/idleBehaviorManager.test.ts` | 1 TS6133 + 2 TS2578 |
| `src/engine/__tests__/tileMap.test.ts` | 3 TS2578 |
| `src/services/collaboration/__tests__/contextBridge.test.ts` | 1 TS6133 |
| `src/store/__tests__/collaborationStore.test.ts` | 1 TS6133 |

### Task 3 — Null-safety (TS18048 + TS2532 = 73 errors)
| File | Errors |
|------|--------|
| `src/engine/pixelScene.ts` | 71 TS18048 |
| `src/store/__tests__/collaborationStore.test.ts` | 2 TS2532 |

### Task 4 — Type mismatches (TS2345 + TS2590 + TS2307 = 19 errors)
| File | Errors |
|------|--------|
| `src/engine/renderer.ts` | 5 TS2345 |
| `src/engine/pixelSprites.ts` | 5 TS2345 |
| `src/engine/pixelScene.ts` | 1 TS2345 |
| `src/engine/characters.ts` | 1 TS2345 |
| `src/engine/idleBehaviorManager.ts` | 1 TS2345 |
| `src/components/collaboration/CollabHistoryList.tsx` | 1 TS2345 |
| `src/hooks/useCollaboration.ts` | 1 TS2345 |
| `src/services/collaboration/chainRunner.ts` | 1 TS2345 |
| `src/engine/__tests__/layoutSerializer.test.ts` | 1 TS2345 |
| `src/engine/furniture48Catalog.ts` | 1 TS2590 (DO NOT read full file — 3.3MB) |
| `src/engine/__tests__/editorRenderer.test.ts` | 1 TS2307 |

### Tasks 5-7 — ErrorBoundary
| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/ui/ErrorBoundary.tsx` | Reusable error boundary component |
| Modify | `src/App.tsx` | Wrap 3 layout zones with ErrorBoundary |
| Modify | `src/components/chat/ChatPanel.tsx` | Inner ErrorBoundary around message area |
| Modify | `package.json` | Fix typecheck script |

---

## Task 1: Fix `npm run typecheck` to actually check files

**Files:**
- Modify: `package.json`

**Context:** `npm run typecheck` runs `tsc --noEmit` which uses root `tsconfig.json`. That file has `"files": []` and no `include`, so it checks nothing — always passes. This must match what `tsc -b` checks.

- [ ] **Step 1: Update tsconfig.json**

Change the `typecheck` script to use project build mode, or add an include to the root tsconfig. The simplest fix is updating `package.json`:

In `package.json`, change:
```json
"typecheck": "tsc --noEmit"
```
to:
```json
"typecheck": "tsc -b --noEmit"
```

This makes `typecheck` use the same project references as `build`, so it catches the same errors.

- [ ] **Step 2: Verify typecheck now catches errors**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: `119` (same errors as `npm run build`)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "fix: make typecheck use project build mode to catch all errors"
```

---

## Task 2: Fix unused variables and imports (21 TS6133 + 1 TS6192 + 5 TS2578 = 27 errors)

**Files:**
- Modify: `src/engine/renderer.ts` (8 TS6133)
- Modify: `src/components/canvas/EditorToolbar.tsx` (3 TS6133)
- Modify: `src/engine/depthSort.ts` (2 TS6133 + 1 TS6192)
- Modify: `src/engine/editorInput.ts` (1 TS6133)
- Modify: `src/hooks/useCollaboration.ts` (1 TS6133)
- Modify: `src/engine/__tests__/idleBehaviorManager.test.ts` (1 TS6133 + 2 TS2578)
- Modify: `src/engine/__tests__/input.test.ts` (3 TS6133)
- Modify: `src/engine/__tests__/tileMap.test.ts` (3 TS2578)
- Modify: `src/services/collaboration/__tests__/contextBridge.test.ts` (1 TS6133)
- Modify: `src/store/__tests__/collaborationStore.test.ts` (1 TS6133)

**Context:** These are the safest errors to fix — removing unused code can't break behavior.

**Note on test baseline:** 29 tests currently fail across 9 test files (pre-existing, not caused by this work). When verifying "tests pass" in this task, confirm no NEW failures in files you modified — don't expect a fully green suite.

- [ ] **Step 1: Fix renderer.ts unused declarations**

Read `src/engine/renderer.ts` and remove or prefix with `_` the following unused declarations:
- Line 23: `ZOOM_OVERVIEW_THRESHOLD` — remove import/declaration
- Line 26: `ROOM_RUGS` — remove import/declaration
- Line 34: `applyFloorTint` — remove import/declaration
- Line 191: `getTileAtlasKey` — remove function
- Line 216: `getTileColor` — remove function
- Line 299: `renderWalls` — remove function
- Line 892: `renderOfficeTitles` — remove function
- Line 1000: `renderRoomLabel` — remove function

**Important:** Before removing a function, grep the codebase to confirm it is truly unused (not imported elsewhere).

- [ ] **Step 2: Fix EditorToolbar.tsx unused declarations (3 TS6133)**

Read `src/components/canvas/EditorToolbar.tsx`. Run `npm run build 2>&1 | grep "EditorToolbar"` to find the 3 unused variable lines. Remove them (grep codebase first to confirm unused).

- [ ] **Step 3: Fix depthSort.ts (2 TS6133 + 1 TS6192) and editorInput.ts (1 TS6133)**

Run `npm run build 2>&1 | grep "depthSort\|editorInput"` to find the exact lines. Remove unused declarations.

- [ ] **Step 4: Fix useCollaboration.ts unused variable (1 TS6133)**

Read `src/hooks/useCollaboration.ts:94`. Remove the unused `chain` variable or prefix with `_chain` if it's needed for a side effect.

- [ ] **Step 5: Fix test file unused vars and stale @ts-expect-error**

For each test file listed above:
- Remove unused imports/variables flagged by TS6133
- Remove `@ts-expect-error` directives that no longer apply (TS2578)
- For `src/store/__tests__/collaborationStore.test.ts` line 3: remove unused `useDealStore` import

**Note:** `editorRenderer.test.ts` and `layoutSerializer.test.ts` are NOT in this task — their errors are TS2307 and TS2345, handled in Task 4.

- [ ] **Step 6: Run build to verify error count dropped**

Run: `npm run build 2>&1 | grep -c "error TS"`
Expected: ~92 (119 - 27 fixed)

- [ ] **Step 7: Run tests on modified files to verify no regressions**

Run: `npm run test 2>&1`
Check: No NEW failures in the files you modified. (29 pre-existing failures in other files are expected.)

- [ ] **Step 8: Commit**

```bash
git add src/engine/renderer.ts src/engine/depthSort.ts src/engine/editorInput.ts src/components/canvas/EditorToolbar.tsx src/hooks/useCollaboration.ts src/engine/__tests__/ src/services/collaboration/__tests__/ src/store/__tests__/
git commit -m "fix: remove unused variables and stale ts-expect-error directives (27 TS errors)"
```

---

## Task 3: Fix null-safety errors (71 TS18048 + 2 TS2532 = 73 errors)

**Files:**
- Modify: `src/engine/pixelScene.ts` (71 TS18048 — largest single source, 60% of all errors)
- Modify: `src/store/__tests__/collaborationStore.test.ts` (2 TS2532)

**Context:** `noUncheckedIndexedAccess: true` in tsconfig.app.json means array/object index access returns `T | undefined`. These need null guards.

- [ ] **Step 1: Get exact error locations**

Run: `npm run build 2>&1 | grep "TS18048\|TS2532"` to get the exact line numbers grouped by file.

- [ ] **Step 2a: Fix pixelScene.ts — identify patterns (71 errors)**

This file has 71 TS18048 errors — the bulk of the work. Before fixing line-by-line, identify the dominant patterns:
```bash
npm run build 2>&1 | grep "pixelScene" | grep -o "'.*'" | sort | uniq -c | sort -rn
```
Most errors will follow 2-3 repeating patterns (e.g., array index access, Map.get(), optional object properties). Fix by pattern, not by line.

- [ ] **Step 2b: Fix pixelScene.ts — apply null guards**

Read the error line ranges and add null guards using:
- Optional chaining: `obj?.prop` for property access
- Early `continue` in loops: `if (!val) continue;` for array index access
- Default values: `const v = arr[i] ?? defaultValue;`
- Non-null assertion `!` ONLY where the value is guaranteed to exist (e.g., length-checked array)

Example for the `hr` possibly-undefined pattern at line 290:
```typescript
// Before:
const x = hr.r + hr.g + hr.b + hr.a;
// After:
if (!hr) continue;
const x = hr.r + hr.g + hr.b + hr.a;
```

- [ ] **Step 2c: Verify pixelScene.ts errors are resolved**

Run: `npm run build 2>&1 | grep "pixelScene" | grep -c "error TS"`
Expected: 0 (down from 71)

- [ ] **Step 3: Fix collaborationStore.test.ts (2 TS2532)**

Lines 145-146: Add non-null assertions or null checks on test assertions where object is possibly undefined.

- [ ] **Step 4: Run build to verify error count dropped**

Run: `npm run build 2>&1 | grep -c "error TS"`
Expected: ~19 (92 - 73 fixed)

- [ ] **Step 5: Run tests on modified files**

Run: `npm run test 2>&1`
Check: No NEW failures in modified files. (29 pre-existing failures expected.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/pixelScene.ts src/store/__tests__/collaborationStore.test.ts
git commit -m "fix: add null guards for strict indexed access (73 TS errors)"
```

---

## Task 4: Fix type mismatches and remaining errors (17 TS2345 + 1 TS2590 + 1 TS2307 = 19 errors)

**Files:**
- Modify: `src/engine/renderer.ts` (5 TS2345 — string→AgentId)
- Modify: `src/engine/pixelSprites.ts` (5 TS2345 — string\|undefined→string)
- Modify: `src/engine/pixelScene.ts` (1 TS2345)
- Modify: `src/engine/characters.ts` (1 TS2345)
- Modify: `src/engine/idleBehaviorManager.ts` (1 TS2345)
- Modify: `src/components/collaboration/CollabHistoryList.tsx` (1 TS2345)
- Modify: `src/hooks/useCollaboration.ts` (1 TS2345 — missing conversationId)
- Modify: `src/services/collaboration/chainRunner.ts` (1 TS2345 — empty string AgentId)
- Modify: `src/engine/__tests__/layoutSerializer.test.ts` (1 TS2345 — mock type mismatch)
- Modify: `src/engine/furniture48Catalog.ts` (1 TS2590 — type complexity. DO NOT read full file, only error line)
- Modify: `src/engine/__tests__/editorRenderer.test.ts` (1 TS2307 — query-string module import)

**Context:** Most TS2345 errors are `string` not assignable to `AgentId`. These occur when iterating over object keys or using `Object.entries()` which returns `string` keys, not the narrower `AgentId` type.

- [ ] **Step 1: Get exact error locations**

Run: `npm run build 2>&1 | grep "TS2345\|TS2590\|TS2307"`

- [ ] **Step 2: Fix renderer.ts AgentId mismatches (5 errors)**

Where `string` is used as `AgentId`, add type assertions or type-safe casts:
```typescript
// Before:
const agentId = roomId; // string
renderAgent(agentId); // expects AgentId

// After:
const agentId = roomId as AgentId; // safe if roomId comes from a known set
```

Only use `as AgentId` where the value is guaranteed to be a valid AgentId (e.g., iterating over known room IDs). If the value comes from user input, add a runtime check first.

- [ ] **Step 3: Fix pixelSprites.ts (5 TS2345), pixelScene.ts (1 TS2345), characters.ts (1), idleBehaviorManager.ts (1), CollabHistoryList.tsx (1), layoutSerializer.test.ts (1)**

Same pattern — `string` not assignable to a narrower type. Apply type assertions or guards as appropriate. For pixelSprites.ts, the errors are `string | undefined` → `string`, which needs null guards + assertion:
```typescript
const val = map.get(key);
if (!val) return;
someFunc(val); // val is now narrowed to string
```

- [ ] **Step 4: Fix useCollaboration.ts message type (1 error)**

Line 58: `{ role: "assistant", content: string }` is missing `conversationId`. Add the required field:
```typescript
// Read the Message type to find what fields are required
// Add the missing conversationId field to the object literal
```

- [ ] **Step 5: Fix chainRunner.ts empty string AgentId (1 error)**

Line 375: `"" | AgentId` not assignable to `AgentId`. Add a guard:
```typescript
if (!agentId) return; // or throw, or continue
```

- [ ] **Step 6: Fix furniture48Catalog.ts TS2590 (type complexity)**

**CAUTION:** 3.3MB file. Only read the error line:
```bash
npm run build 2>&1 | grep "furniture48Catalog"
```
Read only that line range. Fix by adding an explicit type annotation to simplify the union type the compiler is struggling with.

- [ ] **Step 7: Fix editorRenderer.test.ts TS2307 (cannot find module)**

Read `src/engine/__tests__/editorRenderer.test.ts` around line 99 to understand the import. This is likely a Vite query-string import pattern (e.g., `'../editorRenderer?hover=1'`). Fix by either:
- Removing the query string if the test doesn't need it
- Adding a `vi.mock` for the specific import
- Adding a type declaration for the query-string import pattern

- [ ] **Step 8: Run build — should now pass**

Run: `npm run build 2>&1`
Expected: Build succeeds with NO TypeScript errors. Vite build completes and outputs to `dist/`.

- [ ] **Step 9: Run tests on modified files**

Run: `npm run test 2>&1`
Check: No NEW failures in modified files. (29 pre-existing failures expected.)

- [ ] **Step 10: Commit**

```bash
git add src/engine/ src/hooks/ src/services/collaboration/ src/components/collaboration/CollabHistoryList.tsx
git commit -m "fix: resolve type mismatches — string→AgentId casts, type complexity, and module resolution (19 TS errors)"
```

---

## Task 5: Create ErrorBoundary component

**Files:**
- Create: `src/components/ui/ErrorBoundary.tsx`

**Context:** React error boundaries must be class components (hooks don't support `componentDidCatch`). The existing `ErrorBanner` component handles transient API errors — this `ErrorBoundary` handles fatal component crashes. They are separate concerns.

- [ ] **Step 1: Write the test**

Create `src/components/ui/__tests__/ErrorBoundary.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const ThrowingChild = () => {
  throw new Error('Test crash');
};

const GoodChild = () => <div>Working</div>;

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeEach(() => { console.error = vi.fn(); });
  afterEach(() => { console.error = originalError; });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary name="test">
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary name="test-panel">
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/test-panel/i)).toBeInTheDocument();
  });

  it('resets error state when retry is clicked and child no longer throws', () => {
    let shouldThrow = true;
    const MaybeThrowingChild = () => {
      if (shouldThrow) throw new Error('Transient crash');
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary name="test">
        <MaybeThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Simulate transient error resolution
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/ErrorBoundary.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ErrorBoundary**

Create `src/components/ui/ErrorBoundary.tsx`:

```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-icon">!</div>
          <p className="error-boundary-title">Something went wrong</p>
          <p className="error-boundary-detail">
            {this.props.name} encountered an error
          </p>
          <button
            className="error-boundary-retry"
            onClick={this.handleRetry}
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Add CSS for ErrorBoundary fallback**

Append to `src/pixelDesignSystem.css`:

```css
/* ── Error Boundary Fallback ── */
.error-boundary-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
  padding: var(--space-4);
  text-align: center;
  gap: var(--space-2);
  color: var(--text-secondary);
}

.error-boundary-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(192, 96, 80, 0.15);
  color: var(--accent-coral);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-pixel);
  font-size: var(--pixel-md);
}

.error-boundary-title {
  font-family: var(--font-pixel);
  font-size: var(--pixel-sm);
  color: var(--text-primary);
}

.error-boundary-detail {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.error-boundary-retry {
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color 0.15s;
}

.error-boundary-retry:hover {
  border-color: var(--accent-teal);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/ErrorBoundary.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ErrorBoundary.tsx src/components/ui/__tests__/ErrorBoundary.test.tsx src/pixelDesignSystem.css
git commit -m "feat: add ErrorBoundary component with retry and pixel-styled fallback"
```

---

## Task 6: Wire ErrorBoundary into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read current App.tsx layout structure**

Read `src/App.tsx` to find where LeftPanel, center column (AgentBar + OfficeCanvas), and RightPanel are rendered.

- [ ] **Step 2: Wrap layout zones**

Import and wrap the three independent zones:

```tsx
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// In the render/return:
<ErrorBoundary name="Deals & Activity">
  <LeftPanel ... />
</ErrorBoundary>

<ErrorBoundary name="Office Canvas">
  <div className="center-col">
    <AgentBar ... />
    <OfficeCanvas ... />
    {/* ... other center column content */}
  </div>
</ErrorBoundary>

<ErrorBoundary name="Chat & Collaboration">
  <RightPanel ... />
</ErrorBoundary>
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1`
Expected: Build succeeds with 0 TypeScript errors

- [ ] **Step 4: Run tests**

Run: `npm run test 2>&1`
Check: ErrorBoundary tests pass. No NEW failures in modified files.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wrap layout zones with ErrorBoundary for crash isolation"
```

---

## Task 7: Add granular ErrorBoundary inside ChatPanel

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`

**Context:** The spec requires an inner boundary inside ChatPanel around the message rendering area, so a crash in message rendering doesn't take down the chat input or agent selector.

- [ ] **Step 1: Read ChatPanel.tsx layout**

Read `src/components/chat/ChatPanel.tsx` to find where the message list / message area is rendered.

- [ ] **Step 2: Wrap the message rendering area**

```tsx
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Wrap the MessageList or message rendering section:
<ErrorBoundary name="Message Area">
  <MessageList ... />
</ErrorBoundary>
```

The chat input area and agent/tab selectors should remain OUTSIDE the boundary so they still work if messages crash.

- [ ] **Step 3: Verify build and tests**

Run: `npm run build 2>&1 && npm run test 2>&1`
Expected: Build passes. No new test failures.

- [ ] **Step 4: Manual smoke test — cross-panel isolation**

Start dev server if not running: `npm run dev`
Verify at http://localhost:5173:
1. App loads normally with all panels visible
2. ErrorBoundary wrappers are invisible (no visual change)

To verify isolation works, temporarily add `throw new Error('test')` to any component inside one boundary, confirm other panels survive, then remove the throw.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatPanel.tsx
git commit -m "feat: add granular ErrorBoundary around ChatPanel message area"
```

---

## Verification Checklist

After all tasks are complete, verify Phase 1 acceptance criteria:

- [ ] `npm run build` exits 0 (no TypeScript errors)
- [ ] `npm run typecheck` exits 0 (and actually checks files via `tsc -b`)
- [ ] `npm run test` — no new failures (29 pre-existing expected)
- [ ] `npm run lint` — no new lint violations from changes
- [ ] ErrorBoundary renders fallback when a child component crashes
- [ ] Other panels remain functional when one panel crashes (verified by temporarily throwing in one zone)
- [ ] Chat input remains functional when message area crashes
- [ ] Dev server loads normally at http://localhost:5173
