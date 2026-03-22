# Persona Builder — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Phase:** TBD (to be inserted into roadmap after Phase 17)

---

## Overview

An in-app AI-assisted persona builder that lets the user update any agent's brain at any time. Accessed by clicking a filing cabinet `FurnitureItem` in the agent's office on the canvas. The builder is an AI-first chat interface: the user talks to it, uploads a file with pre-written persona content, or both — and it assembles the structured persona. When satisfied, the user previews the agent with the draft persona in an isolated test session, then saves.

---

## Canonical Field Schema

The builder surfaces **6 editable fields**. All fold into the existing `AgentPersona` interface without schema changes.

| Field | Maps to | Description |
|-------|---------|-------------|
| `personality` | `AgentPersona.personality` | One-sentence personality summary for UI display |
| `domain` | `AgentPersona.domain` | Comma-separated domain expertise for UI display |
| `coreIdentity` | section in `personaPrompt` | Who this person is, their defining trait and background |
| `communicationStyle` | section in `personaPrompt` | How they structure responses, tone, what they lead with |
| `bilingualPatterns` | section in `personaPrompt` | Spanish/English terms they use naturally with context |
| `modesOfOperation` | section in `personaPrompt` | How they approach different request types |

`name`, `title`, and `color` are **read-only display fields** in the builder panel — they are set at agent creation time and cannot be changed here (per Out of Scope). They are shown in the sidebar header for context only.

**Save threshold:** ≥ 5 of 6 editable fields must be populated to enable Save.

**Extraction JSON schema** (used by the structured extraction call):

```typescript
interface ExtractedPersonaFields {
  personality: string;
  domain: string;
  coreIdentity: string;
  communicationStyle: string;
  bilingualPatterns: string;
  modesOfOperation: string;
}
```

---

## Entry Point — Filing Cabinet Sprite

`FurnitureItem` already supports `type: 'filing-cabinet'` in `officeLayout.ts`. The filing cabinet is a **static, always-visible, interactive decoration** placed in the NW corner of each agent's office. It is not serialized to IndexedDB (it is static code, same as existing desk/chair entries).

**Tile coordinates** (NW corner of each room, offset +1 col/row from room origin to stay inside walls):

| Agent | col | row | Atlas key |
|-------|-----|-----|-----------|
| Isaac | 3 | 3 | `'filing-cabinet'` |
| Patrik | 33 | 3 | `'filing-cabinet'` |
| Marcos | 3 | 15 | `'filing-cabinet'` |
| Sandra | 33 | 15 | `'filing-cabinet'` |
| Charlie | 3 | 27 | `'filing-cabinet'` |
| Wendy | 33 | 27 | `'filing-cabinet'` |

All use `width: 1, height: 1` (the atlas key `'filing-cabinet'` is defined as `sf('generic', 2, 0, 1, 2)` in `limeZuAtlas.ts`).

**Click detection** — `input.ts` (`src/engine/input.ts`) handles play-mode canvas clicks via `handleClick`. Add a branch after the existing file icon check (lines 116–122): call `getFurnitureAt(tile.col, tile.row)` (returns `number | null` — the index into `FURNITURE`), look up `FURNITURE[idx]` to get the item, and if `item.type === 'filing-cabinet'`, dispatch `openPersonaBuilder(item.roomId)` to `personaBuilderStore` and return early. No selection highlight is shown for filing cabinets. `editorInput.ts` is NOT modified — it exits immediately when the layout editor is inactive and is not the correct handler for play-mode interactions.

**Collision exemption** — `'filing-cabinet'` is in `SOLID_FURNITURE_TYPES` in `tileMap.ts`. The 6 filing cabinet tile coordinates must be added to `getCollisionExemptions()` in `officeLayout.ts` (the same narrow exemption pattern used for seat and stand tiles) so agents are not blocked in the NW corner of each office. `SOLID_FURNITURE_TYPES` itself is not modified.

**Modified files:**
- `src/engine/officeLayout.ts` — add 6 `FurnitureItem` entries in `FURNITURE`; add 6 tile coordinates to `getCollisionExemptions()`
- `src/engine/input.ts` — add `filing-cabinet` click branch in `handleClick`

---

## Panel Layout

Full-screen overlay rendered above the canvas in the React tree (same layer as deal panels). Two columns: AI chat (left, flex: 1) + live fields sidebar (right, fixed 240px).

### Left Column — AI Chat

- **Header:** agent color dot + agent name + title (read-only display)
- **Message thread:** AI interview questions and user responses, scrollable
- **File upload button:** always visible above the input bar; accepts `.md`, `.txt`, `.pdf`, `.docx`; triggers file ingestion flow (see below)
- **Text input + Send button**
- **Mode:** controlled by `personaBuilderStore.mode` (`'interview' | 'preview'`)
  - In `'interview'` mode: shows `interviewMessages`, input active, sends to meta-AI
  - In `'preview'` mode: shows `previewMessages`, input active, sends to agent using draft persona; a "← Back to Build" button replaces the upload button

### Right Column — Live Fields Sidebar

- **Agent header:** name + title + color swatch (read-only)
- **6 field rows:** label + value cell for each canonical field; value cell is empty/italic when unpopulated, highlighted in agent color when populated
- **Progress bar:** `(populatedFields / 6) * 100%`, agent color fill
- **Progress label:** "N% complete — X fields remaining" (hidden when all 6 filled)
- **Preview Agent button:** enabled always; opens preview mode
- **Save Persona button:** disabled until ≥ 5/6 fields populated; label shows "X fields remaining" when disabled; on click → triggers save flow

---

## AI Interview System

### Meta-AI (Persona Builder AI)

A dedicated Claude API call. Its system prompt contains:

```
You are a persona builder assistant for Lemon Studios. Your job is to help the user define the brain of an AI agent named [name] ([title]).

Current persona (may be empty):
[current personaPrompt]

Ask one targeted question at a time. Open with what's most missing or thin.
For a new agent: ask about their superpower — the one thing they do no one else does.
For an existing agent: ask what the current persona doesn't capture.
Never ask more than one question per message.
After 6 exchanges or when all fields feel complete, summarize what you've gathered and suggest the user run Preview.
```

The meta-AI receives the full `interviewMessages` transcript on each call (no truncation — personas are short).

### File Upload Ingestion

1. User selects a file → text is extracted **client-side**:
   - `.md` / `.txt` → read directly via `FileReader`
   - `.pdf` → `extractPdf.ts` (already exists at `src/services/files/extractPdf.ts`)
   - `.docx` → `extractDocx.ts` (already exists at `src/services/files/extractDocx.ts`)
   - File size limit: 500KB post-extraction; larger files are truncated at 500KB with a warning message in the chat
2. Extracted text is injected into the meta-AI context as an `<uploaded_document>` block and appended to `interviewMessages` as a user message: `"[File uploaded: filename.md]\n<uploaded_document>…</uploaded_document>"`
3. The meta-AI responds, then the extraction pass runs immediately (see below)
4. No `/api/persona/parse-file` endpoint is needed — all extraction is client-side

### Field Extraction Pass

Runs **after every meta-AI response** (sequential, not parallel). A second Claude API call with:

- Input: full `interviewMessages` transcript + any uploaded document text + current `personaPrompt`
- System prompt: instructs strict JSON output matching `ExtractedPersonaFields`
- Merge strategy: the extraction prompt explicitly instructs the AI to **rewrite each field incorporating all sources** (current prompt + transcript + uploaded doc). Each extracted field value replaces the current sidebar value entirely. This is AI-mediated synthesis, not concatenation.
- On success: `personaBuilderStore.setFields(extracted)` updates the sidebar live
- On failure / malformed JSON: silently ignore, sidebar retains previous values

**Call sequencing per user message:**
1. User sends message (or uploads file)
2. Meta-AI streaming response renders in chat
3. After stream ends: extraction call fires (non-streaming, silent — no UI indicator)
4. Sidebar fields update
5. Progress bar updates

---

## Preview Mode

Triggered by "Preview Agent" button in sidebar.

- `personaBuilderStore.mode` switches to `'preview'`
- Left column switches from `interviewMessages` to a fresh `previewMessages` array
- Draft `systemPrompt` is assembled from the current sidebar field values using the same context-builder pattern as live agents (combines base system prompt + assembled `personaPrompt` from the 4 prose fields)
- Preview Claude call uses `claude-sonnet-4-6`, same model as main chat
- **Isolation guarantees:** no writes to `chatStore`, no entries in chat history, no canvas animations, no idle behavior triggers, no `collaborationStore` interaction
- **"← Back to Build"** button:
  - Sets `mode` back to `'interview'`
  - Appends a synthetic message to `interviewMessages`: `"[Preview feedback: user tested the agent — last preview message: "${lastPreviewUserMessage}"]"` so the meta-AI has context for any requested adjustments
  - Discards `previewMessages`
- Preview session is fully discarded on panel close; no cleanup needed

---

## Save Flow

On "Save Persona" click:

1. Assembles final `personaPrompt` string from the 4 prose fields (`coreIdentity`, `communicationStyle`, `bilingualPatterns`, `modesOfOperation`) using a standard template structure (same section headings as existing agents)
2. Calls `POST /api/persona/save` (see Server section below) with:
   ```typescript
   {
     agentId: AgentId;
     personality: string;
     domain: string;
     personaPrompt: string;      // fully assembled
     skillFileContent: string;   // generated by a final Claude call (see below)
   }
   ```
3. On success: closes panel, shows a brief toast "Charlie's persona updated"
4. On error: shows error in panel, does not close

**Skill file generation:** Before calling the save endpoint, a final Claude call generates the skill file content — the full `.md` document including frontmatter `description` field with AI-extracted trigger keywords. This is the last AI call in the flow.

**HMR note:** Vite HMR will reload the `[name].ts` module when the file changes. This may reset Zustand store state that was hydrated from that module. This is acceptable behavior — the persona builder panel closes before the HMR reload completes, and the agent's updated persona is immediately available in the next conversation.

---

## Server — Vite Dev Middleware

The save endpoint is implemented as a **Vite plugin with `configureServer` middleware**. This runs only during development (`vite dev`), has Node.js file-system access, and requires no separate server process.

**Plugin location:** `vite-plugin-persona-writer.ts` (co-located with `vite.config.ts`)

**Routes handled:**

`POST /api/persona/save`
- Body: `{ agentId, personality, domain, personaPrompt, skillFileContent }`
- Writes `src/config/agents/[agentId].ts` via **full-file template rewrite**: the plugin generates the entire file from a template, substituting all field values. The export name follows the pattern `${agentId}Persona` (e.g., `isaacPersona`, `charliePersona`). The header JSDoc comment and `import type { AgentPersona }` import are preserved from the template. This is simpler and safer than regex-based field replacement.
- Writes `~/.claude/skills/[agentId]-[title-slug].md` — full skill file content (path resolved via `os.homedir()`)
- Returns `{ ok: true }` or `{ ok: false, error: string }`
- **Does not update `src/config/agents/index.ts`** — all current agents are already imported there; persona edits do not affect the import

**Production behavior:** The plugin is excluded from production builds. The persona builder UI component renders `null` in production mode (`import.meta.env.PROD`).

---

## Component Tree

```
PersonaBuilderOverlay          ← full-screen overlay; mounts when personaBuilderStore.isOpen
  PersonaBuilderChat           ← left column; mode-aware (interview | preview)
    ChatMessageList
    FileUploadButton            ← .md / .txt / .pdf / .docx; client-side extraction
    ChatInput
  PersonaFieldsSidebar         ← right column
    AgentHeader                 ← read-only: name, title, color
    FieldRow × 6               ← one per canonical field
    ProgressBar
    PreviewButton
    SaveButton
```

**New files:**
- `src/components/persona-builder/PersonaBuilderOverlay.tsx`
- `src/components/persona-builder/PersonaBuilderChat.tsx`
- `src/components/persona-builder/PersonaFieldsSidebar.tsx`
- `src/stores/personaBuilderStore.ts`
- `src/services/personaBuilderService.ts`
- `vite-plugin-persona-writer.ts`

**Modified files:**
- `src/engine/officeLayout.ts` — add 6 filing cabinet `FurnitureItem` entries + collision exemptions
- `src/engine/input.ts` — add `filing-cabinet` click dispatch in `handleClick`
- `vite.config.ts` — register `vitePluginPersonaWriter()`

### `PersonaMessage` type

A local type used only within the persona builder. Do not reuse `Message` from `src/types/chat.ts` — that type requires `conversationId` which has no meaning here.

```typescript
interface PersonaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

### `personaBuilderStore` shape

```typescript
interface PersonaBuilderStore {
  isOpen: boolean;
  agentId: AgentId | null;
  mode: 'interview' | 'preview';
  interviewMessages: PersonaMessage[];
  previewMessages: PersonaMessage[];
  fields: Partial<ExtractedPersonaFields>;
  isSaving: boolean;
  // actions
  open: (agentId: AgentId) => void;
  close: () => void;
  setMode: (mode: 'interview' | 'preview') => void;
  setFields: (fields: Partial<ExtractedPersonaFields>) => void;
  appendInterviewMessage: (msg: PersonaMessage) => void;
  appendPreviewMessage: (msg: PersonaMessage) => void;
  backToBuild: (lastPreviewUserMessage: string) => void;
}
```

### `personaBuilderService` responsibilities

- `runInterviewTurn(agentId, messages, uploadedDocText?)` → streams meta-AI response, then fires extraction pass
- `runExtractionPass(transcript, currentPersonaPrompt)` → returns `ExtractedPersonaFields | null`
- `assemblePersonaPrompt(fields)` → returns the final `personaPrompt` string
- `generateSkillFile(agentId, fields)` → Claude call, returns skill `.md` content
- `savePersona(agentId, fields, personaPrompt, skillFileContent)` → calls `/api/persona/save`

---

## Guardrails

- Save disabled until ≥ 5/6 fields populated; button label: "Keep building — X fields missing"
- Preview is fully isolated — zero side effects on app state
- File upload: 500KB text limit post-extraction; truncated with inline warning
- Meta-AI and extraction calls use `claude-sonnet-4-6`
- Skill file generation uses `claude-sonnet-4-6`
- All Claude calls go through existing `/api/anthropic` Vite proxy (API key never exposed to client)
- Panel renders `null` in `import.meta.env.PROD`
- Filing cabinets are excluded from furniture collision detection (same exemption pattern as existing non-blocking furniture)

---

## Out of Scope

- Creating new agents or deleting existing agents (builder is edit-only)
- Changing `id`, `name`, `title`, or `color` from the builder
- Version history or undo for persona changes
- Multi-agent batch editing in one session
- Production file-writing (builder is a dev-time tool only)
- `src/config/agents/index.ts` updates (all current agents already registered)
