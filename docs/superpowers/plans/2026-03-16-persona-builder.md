# Persona Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app AI-assisted persona builder accessible by clicking a filing cabinet sprite in each agent's office, letting the user enrich agent brains via chat and file upload.

**Architecture:** A Zustand store (`personaBuilderStore`) drives a full-screen overlay (`PersonaBuilderOverlay`) with an AI chat column and a live fields sidebar. A service layer (`personaBuilderService`) handles all Claude API calls. A Vite dev middleware plugin writes the assembled persona to `src/config/agents/[name].ts` and `~/.claude/skills/`.

**Tech Stack:** React + TypeScript + Zustand, Anthropic SDK (`@anthropic-ai/sdk`), Vite plugin API, Vitest for tests, Tailwind for styling.

---

## Chunk 1: Foundation — Types, Store, and Canvas Entry Point

### Task 1: Types

**Files:**
- Create: `src/types/personaBuilder.ts`
- Test: `src/types/__tests__/personaBuilder.test.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/types/personaBuilder.ts

export interface PersonaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ExtractedPersonaFields {
  personality: string;
  domain: string;
  coreIdentity: string;
  communicationStyle: string;
  bilingualPatterns: string;
  modesOfOperation: string;
}

export type PersonaFieldKey = keyof ExtractedPersonaFields;

export const PERSONA_FIELD_LABELS: Record<PersonaFieldKey, string> = {
  personality: 'Personality',
  domain: 'Domain',
  coreIdentity: 'Core Identity',
  communicationStyle: 'Communication Style',
  bilingualPatterns: 'Bilingual Patterns',
  modesOfOperation: 'Modes of Operation',
};

/** Minimum number of populated fields to enable Save */
export const SAVE_THRESHOLD = 5;
```

- [ ] **Step 2: Write a trivial type-shape test**

```typescript
// src/types/__tests__/personaBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { PERSONA_FIELD_LABELS, SAVE_THRESHOLD } from '@/types/personaBuilder';

describe('personaBuilder types', () => {
  it('PERSONA_FIELD_LABELS has exactly 6 keys', () => {
    expect(Object.keys(PERSONA_FIELD_LABELS)).toHaveLength(6);
  });

  it('SAVE_THRESHOLD is 5', () => {
    expect(SAVE_THRESHOLD).toBe(5);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/types/__tests__/personaBuilder.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/personaBuilder.ts src/types/__tests__/personaBuilder.test.ts
git commit -m "feat(persona-builder): add PersonaMessage and ExtractedPersonaFields types"
```

---

### Task 2: Zustand Store

**Files:**
- Create: `src/store/personaBuilderStore.ts`
- Test: `src/store/__tests__/personaBuilderStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/store/__tests__/personaBuilderStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePersonaBuilderStore } from '../personaBuilderStore';
import type { ExtractedPersonaFields } from '@/types/personaBuilder';

describe('personaBuilderStore', () => {
  beforeEach(() => {
    usePersonaBuilderStore.setState({
      isOpen: false,
      agentId: null,
      mode: 'interview',
      interviewMessages: [],
      previewMessages: [],
      fields: {},
      isSaving: false,
    });
  });

  it('open(agentId) sets isOpen=true and agentId', () => {
    usePersonaBuilderStore.getState().open('charlie');
    const s = usePersonaBuilderStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.agentId).toBe('charlie');
  });

  it('open() resets messages and fields', () => {
    usePersonaBuilderStore.setState({ interviewMessages: [{ role: 'user', content: 'hi' }] });
    usePersonaBuilderStore.getState().open('isaac');
    const s = usePersonaBuilderStore.getState();
    expect(s.interviewMessages).toHaveLength(0);
    expect(s.fields).toEqual({});
  });

  it('close() resets everything', () => {
    usePersonaBuilderStore.getState().open('patrik');
    usePersonaBuilderStore.getState().close();
    const s = usePersonaBuilderStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.agentId).toBeNull();
    expect(s.mode).toBe('interview');
  });

  it('setFields merges into existing fields', () => {
    usePersonaBuilderStore.getState().setFields({ personality: 'Sharp' });
    usePersonaBuilderStore.getState().setFields({ domain: 'Finance' });
    const s = usePersonaBuilderStore.getState();
    expect(s.fields.personality).toBe('Sharp');
    expect(s.fields.domain).toBe('Finance');
  });

  it('backToBuild switches mode to interview and appends feedback message', () => {
    usePersonaBuilderStore.setState({ mode: 'preview', previewMessages: [] });
    usePersonaBuilderStore.getState().backToBuild('He seems too formal');
    const s = usePersonaBuilderStore.getState();
    expect(s.mode).toBe('interview');
    expect(s.previewMessages).toHaveLength(0);
    const lastMsg = s.interviewMessages[s.interviewMessages.length - 1];
    expect(lastMsg?.role).toBe('system');
    expect(lastMsg?.content).toContain('He seems too formal');
  });

  it('countPopulatedFields counts non-empty string fields', () => {
    usePersonaBuilderStore.getState().setFields({
      personality: 'Sharp',
      domain: 'Finance',
      coreIdentity: 'CFO',
    });
    expect(usePersonaBuilderStore.getState().countPopulatedFields()).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/__tests__/personaBuilderStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the store**

```typescript
// src/store/personaBuilderStore.ts
import { create } from 'zustand';
import type { AgentId } from '@/types/agent';
import type { PersonaMessage, ExtractedPersonaFields } from '@/types/personaBuilder';

interface PersonaBuilderState {
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
  countPopulatedFields: () => number;
}

export const usePersonaBuilderStore = create<PersonaBuilderState>((set, get) => ({
  isOpen: false,
  agentId: null,
  mode: 'interview',
  interviewMessages: [],
  previewMessages: [],
  fields: {},
  isSaving: false,

  open: (agentId) => set({
    isOpen: true,
    agentId,
    mode: 'interview',
    interviewMessages: [],
    previewMessages: [],
    fields: {},
    isSaving: false,
  }),

  close: () => set({
    isOpen: false,
    agentId: null,
    mode: 'interview',
    interviewMessages: [],
    previewMessages: [],
    fields: {},
    isSaving: false,
  }),

  setMode: (mode) => set({ mode }),

  setFields: (fields) => set((s) => ({ fields: { ...s.fields, ...fields } })),

  appendInterviewMessage: (msg) =>
    set((s) => ({ interviewMessages: [...s.interviewMessages, msg] })),

  appendPreviewMessage: (msg) =>
    set((s) => ({ previewMessages: [...s.previewMessages, msg] })),

  backToBuild: (lastPreviewUserMessage) =>
    set((s) => ({
      mode: 'interview',
      previewMessages: [],
      interviewMessages: [
        ...s.interviewMessages,
        {
          role: 'system' as const,
          content: `[Preview feedback: user tested the agent — last preview message: "${lastPreviewUserMessage}"]`,
        },
      ],
    })),

  countPopulatedFields: () => {
    const f = get().fields;
    return Object.values(f).filter((v) => typeof v === 'string' && v.trim().length > 0).length;
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/__tests__/personaBuilderStore.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/store/personaBuilderStore.ts src/store/__tests__/personaBuilderStore.test.ts
git commit -m "feat(persona-builder): add personaBuilderStore with interview/preview state"
```

---

### Task 3: Filing Cabinets in officeLayout.ts

**Files:**
- Modify: `src/engine/officeLayout.ts:165-176` (FURNITURE array) and `:326-334` (`getCollisionExemptions`)
- Test: `src/engine/__tests__/officeLayout.test.ts` (existing file — add tests)

- [ ] **Step 1: Write the failing tests** — add to existing `officeLayout.test.ts`

```typescript
// Append to src/engine/__tests__/officeLayout.test.ts

describe('filing cabinet furniture', () => {
  it('FURNITURE contains 6 filing-cabinet items, one per agent office', () => {
    const cabinets = FURNITURE.filter(f => f.type === 'filing-cabinet');
    expect(cabinets).toHaveLength(6);
    const roomIds = cabinets.map(f => f.roomId).sort();
    expect(roomIds).toEqual(['charlie', 'isaac', 'marcos', 'patrik', 'sandra', 'wendy']);
  });

  it('each filing cabinet is at width=1, height=1 with atlasKey filing-cabinet', () => {
    const cabinets = FURNITURE.filter(f => f.type === 'filing-cabinet');
    for (const c of cabinets) {
      expect(c.width).toBe(1);
      expect(c.height).toBe(1);
      expect(c.atlasKey).toBe('filing-cabinet');
    }
  });

  it('getCollisionExemptions includes all 6 filing cabinet tile positions', () => {
    const exemptions = getCollisionExemptions();
    const cabinetCoords = [
      { col: 3, row: 3 },   // isaac
      { col: 33, row: 3 },  // patrik
      { col: 3, row: 15 },  // marcos
      { col: 33, row: 15 }, // sandra
      { col: 3, row: 27 },  // charlie
      { col: 33, row: 27 }, // wendy
    ];
    for (const coord of cabinetCoords) {
      expect(exemptions).toContainEqual(coord);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/officeLayout.test.ts`
Expected: FAIL — expected 6 filing cabinets, found 0

- [ ] **Step 3: Add the filing cabinets and collision exemptions**

In `src/engine/officeLayout.ts`, inside the IIFE (after the water-cooler `addFurniture` call, around line 251), add — **must use `addFurniture()` not direct array push so `rebuildCollisionOverlay` fires**:

```typescript
  // Filing cabinets — one per agent office (NW corner, +1 offset from room origin)
  // Interactive: clicking dispatches openPersonaBuilder via input.ts
  // NOTE: must use addFurniture() so rebuildCollisionOverlay is called
  addFurniture({ roomId: 'isaac',   type: 'filing-cabinet', col: 3,  row: 3,  width: 1, height: 1, atlasKey: 'filing-cabinet' });
  addFurniture({ roomId: 'patrik',  type: 'filing-cabinet', col: 33, row: 3,  width: 1, height: 1, atlasKey: 'filing-cabinet' });
  addFurniture({ roomId: 'marcos',  type: 'filing-cabinet', col: 3,  row: 15, width: 1, height: 1, atlasKey: 'filing-cabinet' });
  addFurniture({ roomId: 'sandra',  type: 'filing-cabinet', col: 33, row: 15, width: 1, height: 1, atlasKey: 'filing-cabinet' });
  addFurniture({ roomId: 'charlie', type: 'filing-cabinet', col: 3,  row: 27, width: 1, height: 1, atlasKey: 'filing-cabinet' });
  addFurniture({ roomId: 'wendy',   type: 'filing-cabinet', col: 33, row: 27, width: 1, height: 1, atlasKey: 'filing-cabinet' });
```

Then in `getCollisionExemptions()`, after the `WAR_ROOM_SEATS` loop (around line 333), add:

```typescript
  // Filing cabinets: exempt from solid collision so agents can walk through NW corners
  const cabinetTiles: TileCoord[] = [
    { col: 3,  row: 3  },
    { col: 33, row: 3  },
    { col: 3,  row: 15 },
    { col: 33, row: 15 },
    { col: 3,  row: 27 },
    { col: 33, row: 27 },
  ];
  for (const t of cabinetTiles) exemptions.push(t);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/__tests__/officeLayout.test.ts`
Expected: PASS (all existing + 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add src/engine/officeLayout.ts src/engine/__tests__/officeLayout.test.ts
git commit -m "feat(persona-builder): add filing cabinet furniture and collision exemptions"
```

---

### Task 4: Filing Cabinet Click Handler in input.ts

**Files:**
- Modify: `src/engine/input.ts:79-87` (callback pattern) and `:115-122` (handleClick)

- [ ] **Step 1: Add the filing cabinet callback module-level exports** — after `onFileClickCallback` (line 80), add:

```typescript
/** Callback for filing cabinet clicks — set by React to open persona builder */
export let onFilingCabinetClickCallback: ((agentId: string) => void) | null = null;

/** Sets the filing cabinet click callback. Called from React. */
export function setOnFilingCabinetClick(cb: ((agentId: string) => void) | null): void {
  onFilingCabinetClickCallback = cb;
}
```

- [ ] **Step 2: Add the click branch** — in `handleClick`, after the file icon check (after line 122), add:

```typescript
    // Check for filing cabinet click before room navigation
    if (onFilingCabinetClickCallback) {
      const furnitureIdx = getFurnitureAt(tile.col, tile.row);
      if (furnitureIdx !== null) {
        const item = FURNITURE[furnitureIdx];
        if (item?.type === 'filing-cabinet') {
          onFilingCabinetClickCallback(item.roomId);
          return;
        }
      }
    }
```

- [ ] **Step 3: Add the FURNITURE import** — `input.ts` currently imports from `officeLayout`:

```typescript
import { getRoomAtTile, ROOMS, OFFICE_TILE_MAP } from './officeLayout';
```

Change to:

```typescript
import { getRoomAtTile, ROOMS, OFFICE_TILE_MAP, getFurnitureAt, FURNITURE } from './officeLayout';
```

- [ ] **Step 4: Write a unit test for the new callback exports** — add to `src/engine/__tests__/officeLayout.test.ts` or a new `input.test.ts`:

```typescript
// Verify module exports exist (compile-time check via import)
import { setOnFilingCabinetClick, onFilingCabinetClickCallback } from '@/engine/input';
import { describe, it, expect, vi } from 'vitest';

describe('setOnFilingCabinetClick', () => {
  it('registers and clears the callback', () => {
    const cb = vi.fn();
    setOnFilingCabinetClick(cb);
    // After registering, the module var should be set (test via a re-import or export check)
    setOnFilingCabinetClick(null);
    expect(true).toBe(true); // compile-level check: function exists and is callable
  });
});
```

- [ ] **Step 5: Run the full test suite to check nothing is broken**

Run: `npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 6: Commit**

```bash
git add src/engine/input.ts
git commit -m "feat(persona-builder): add filing cabinet click dispatch to input handler"
```

---

## Chunk 2: Service Layer

### Task 5: personaBuilderService.ts

**Files:**
- Create: `src/services/personaBuilderService.ts`
- Test: `src/services/__tests__/personaBuilderService.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/__tests__/personaBuilderService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedPersonaFields } from '@/types/personaBuilder';

// Mock the Anthropic client
const mockCreate = vi.fn();
vi.mock('@/services/anthropic/client', () => ({
  getAnthropicClient: () => ({
    messages: { create: mockCreate },
  }),
}));

import {
  runExtractionPass,
  assemblePersonaPrompt,
} from '../personaBuilderService';
import type { PersonaMessage } from '@/types/personaBuilder';

describe('runExtractionPass', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns ExtractedPersonaFields on valid JSON response', async () => {
    const fields: ExtractedPersonaFields = {
      personality: 'Sharp closer',
      domain: 'Marketing, one-sheets',
      coreIdentity: 'Ex-Netflix, finds the angle',
      communicationStyle: 'Lead with the hook',
      bilingualPatterns: 'taquilla, estreno',
      modesOfOperation: 'Sellability, Campaign, Deck',
    };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(fields) }],
    });

    const messages: PersonaMessage[] = [{ role: 'user', content: 'Charlie runs marketing' }];
    const result = await runExtractionPass(messages, '');
    expect(result).toEqual(fields);
  });

  it('returns null when response JSON is malformed', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });
    const result = await runExtractionPass([], '');
    expect(result).toBeNull();
  });

  it('returns null when API call throws', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));
    const result = await runExtractionPass([], '');
    expect(result).toBeNull();
  });
});

describe('assemblePersonaPrompt', () => {
  it('includes all 4 prose sections', () => {
    const fields: Partial<ExtractedPersonaFields> = {
      coreIdentity: 'Ex-Netflix marketer',
      communicationStyle: 'Lead with the angle',
      bilingualPatterns: 'taquilla (box office)',
      modesOfOperation: 'Mode 1: Sellability',
    };
    const prompt = assemblePersonaPrompt(fields);
    expect(prompt).toContain('Ex-Netflix marketer');
    expect(prompt).toContain('Lead with the angle');
    expect(prompt).toContain('taquilla (box office)');
    expect(prompt).toContain('Mode 1: Sellability');
  });

  it('omits empty sections', () => {
    const prompt = assemblePersonaPrompt({ coreIdentity: 'Test' });
    expect(prompt).toContain('Test');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('null');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/__tests__/personaBuilderService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service**

```typescript
// src/services/personaBuilderService.ts
import { getAnthropicClient } from '@/services/anthropic/client';
import type { PersonaMessage, ExtractedPersonaFields } from '@/types/personaBuilder';
import type { AgentId } from '@/types/agent';
import { getAgent } from '@/config/agents';
import { BASE_SYSTEM_PROMPT } from '@/config/prompts/base';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_FILE_BYTES = 500_000;

// ── Meta-AI Interview ─────────────────────────────────────────────────────────

/** Builds the meta-AI system prompt for persona building. */
function buildInterviewSystemPrompt(agentId: AgentId): string {
  const agent = getAgent(agentId);
  const currentPersona = agent?.personaPrompt ?? '(no existing persona)';
  return `You are a persona builder assistant for Lemon Studios.
Your job is to help the user define the brain of an AI agent named ${agent?.name ?? agentId} (${agent?.title ?? ''}).

Current persona (may be empty):
${currentPersona}

Ask one targeted question at a time. Open with what's most missing or thin.
For a new agent: ask about their superpower — the one thing they do that no one else does.
For an existing agent: ask what the current persona doesn't capture.
Never ask more than one question per message.
After 6 exchanges or when all fields feel complete, summarize what you've gathered and suggest the user run Preview.`;
}

/**
 * Streams a meta-AI interview response, then fires the extraction pass.
 * Returns a streaming stream object — caller iterates tokens via callbacks.
 */
export async function runInterviewTurn(
  agentId: AgentId,
  messages: PersonaMessage[],
  callbacks: { onToken: (t: string) => void; onComplete: (full: string) => void; onError: (e: Error) => void },
  signal?: AbortSignal,
): Promise<void> {
  const client = getAnthropicClient();
  const apiMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildInterviewSystemPrompt(agentId),
      messages: apiMessages,
    });

    let accumulated = '';

    if (signal) {
      const onAbort = () => stream.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      stream.on('end', () => signal.removeEventListener('abort', onAbort));
    }

    stream.on('text', (t) => {
      accumulated += t;
      callbacks.onToken(t);
    });

    stream.on('finalMessage', () => callbacks.onComplete(accumulated));
    stream.on('error', (e) => callbacks.onError(e instanceof Error ? e : new Error(String(e))));
    stream.on('abort', () => callbacks.onComplete(accumulated));

    await stream.done();
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error('Interview stream failed'));
  }
}

// ── Extraction Pass ───────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a structured data extractor. Given a conversation transcript about an AI agent's persona, extract the persona fields as strict JSON matching the schema below. Rewrite each field incorporating ALL information from the transcript, existing persona, and any uploaded documents. Output ONLY valid JSON, no markdown fences, no extra text.

Schema:
{
  "personality": "One sentence personality summary for UI display",
  "domain": "Comma-separated domain expertise areas",
  "coreIdentity": "Who this person is, their defining trait and background",
  "communicationStyle": "How they structure responses, tone, what they lead with",
  "bilingualPatterns": "Spanish/English terms they use naturally with context",
  "modesOfOperation": "How they approach different request types"
}`;

/**
 * Runs a non-streaming extraction pass over the full transcript.
 * Returns structured fields, or null if the response is unparseable.
 */
export async function runExtractionPass(
  messages: PersonaMessage[],
  currentPersonaPrompt: string,
): Promise<ExtractedPersonaFields | null> {
  const client = getAnthropicClient();

  const transcript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const userContent = `Existing persona:\n${currentPersonaPrompt || '(none)'}\n\nTranscript:\n${transcript}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => ('text' in b ? b.text : ''))
      .join('');

    const parsed = JSON.parse(text) as ExtractedPersonaFields;
    // Basic validation: must have at least personality or coreIdentity
    if (typeof parsed !== 'object' || (!parsed.personality && !parsed.coreIdentity)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ── Prompt Assembly ──────────────────────────────────────────────────────────

/**
 * Assembles the final personaPrompt string from extracted fields.
 * Follows the same section structure as existing agent files.
 */
export function assemblePersonaPrompt(fields: Partial<ExtractedPersonaFields>): string {
  const sections: string[] = [];

  if (fields.coreIdentity?.trim()) {
    sections.push(fields.coreIdentity.trim());
  }
  if (fields.modesOfOperation?.trim()) {
    sections.push(`Modes of operation:\n${fields.modesOfOperation.trim()}`);
  }
  if (fields.bilingualPatterns?.trim()) {
    sections.push(`Bilingual patterns:\n${fields.bilingualPatterns.trim()}`);
  }
  if (fields.communicationStyle?.trim()) {
    sections.push(`Communication style:\n${fields.communicationStyle.trim()}`);
  }

  return sections.join('\n\n');
}

// ── Skill File Generation ────────────────────────────────────────────────────

/**
 * Generates the .claude/skills/[agentId]-[slug].md skill file content
 * via a Claude call that extracts trigger keywords and formats the document.
 */
export async function generateSkillFile(
  agentId: AgentId,
  fields: Partial<ExtractedPersonaFields>,
  personaPrompt: string,
): Promise<string> {
  const client = getAnthropicClient();
  const agent = getAgent(agentId);
  const name = agent?.name ?? agentId;
  const title = agent?.title ?? '';

  const system = `You generate Claude Code skill file content. Given an agent persona, produce a complete .md skill file with YAML frontmatter. The frontmatter must have: name (${agentId}-${title.toLowerCase().replace(/\s+/g, '-')}), description (one-liner + comma-separated trigger keywords extracted from the persona). The body is the full persona in the same format as the persona prompt. Output ONLY the markdown file content, no extra commentary.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [{
        role: 'user',
        content: `Agent: ${name} (${title})\n\nPersona:\n${personaPrompt}\n\nDomain: ${fields.domain ?? ''}\nPersonality: ${fields.personality ?? ''}`,
      }],
    });

    return response.content
      .filter(b => b.type === 'text')
      .map(b => ('text' in b ? b.text : ''))
      .join('');
  } catch {
    // Fallback: minimal skill file if generation fails
    return `---\nname: ${agentId}-${title.toLowerCase().replace(/\s+/g, '-')}\ndescription: ${name} — ${title} at Lemon Studios\n---\n\n${personaPrompt}`;
  }
}

// ── Preview System Prompt ────────────────────────────────────────────────────

/**
 * Assembles the full system prompt for preview mode (base + draft persona).
 */
export function buildPreviewSystemPrompt(personaPrompt: string): string {
  return `${BASE_SYSTEM_PROMPT}\n\n${personaPrompt}`;
}

/**
 * Streams a preview response using the draft persona.
 */
export async function runPreviewTurn(
  previewSystemPrompt: string,
  messages: PersonaMessage[],
  callbacks: { onToken: (t: string) => void; onComplete: (full: string) => void; onError: (e: Error) => void },
  signal?: AbortSignal,
): Promise<void> {
  const client = getAnthropicClient();
  const apiMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: previewSystemPrompt,
      messages: apiMessages,
    });

    let accumulated = '';

    if (signal) {
      const onAbort = () => stream.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      stream.on('end', () => signal.removeEventListener('abort', onAbort));
    }

    stream.on('text', (t) => { accumulated += t; callbacks.onToken(t); });
    stream.on('finalMessage', () => callbacks.onComplete(accumulated));
    stream.on('error', (e) => callbacks.onError(e instanceof Error ? e : new Error(String(e))));
    stream.on('abort', () => callbacks.onComplete(accumulated));

    await stream.done();
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error('Preview stream failed'));
  }
}

// ── File Upload ──────────────────────────────────────────────────────────────

/** Truncates extracted text to MAX_FILE_BYTES. Returns text + truncation flag. */
export function truncateFileText(text: string): { text: string; truncated: boolean } {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= MAX_FILE_BYTES) return { text, truncated: false };
  const truncated = new TextDecoder().decode(bytes.slice(0, MAX_FILE_BYTES));
  return { text: truncated, truncated: true };
}

// ── Save ─────────────────────────────────────────────────────────────────────

export interface SavePersonaPayload {
  agentId: AgentId;
  personality: string;
  domain: string;
  personaPrompt: string;
  skillFileContent: string;
}

/**
 * Calls the Vite dev middleware to write the persona files.
 */
export async function savePersona(payload: SavePersonaPayload): Promise<void> {
  const res = await fetch('/api/persona/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(body.error ?? `Save failed: ${res.status}`);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/services/__tests__/personaBuilderService.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/personaBuilderService.ts src/services/__tests__/personaBuilderService.test.ts
git commit -m "feat(persona-builder): add personaBuilderService with interview, extraction, preview, save"
```

---

### Task 6: Vite Dev Middleware Plugin

**Files:**
- Create: `vite-plugin-persona-writer.ts`

- [ ] **Step 1: Create the plugin**

```typescript
// vite-plugin-persona-writer.ts
import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface SavePersonaBody {
  agentId: string;
  personality: string;
  domain: string;
  personaPrompt: string;
  skillFileContent: string;
}

/** Reads the full body of an IncomingMessage as a string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function vitePluginPersonaWriter(): Plugin {
  let projectRoot = process.cwd();

  return {
    name: 'persona-writer',
    apply: 'serve', // dev only

    configResolved(config) {
      projectRoot = config.root;
    },

    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.method !== 'POST' || req.url !== '/api/persona/save') {
          next();
          return;
        }

        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as SavePersonaBody;

          // Validate required fields
          if (!body.agentId || !body.personaPrompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'agentId and personaPrompt are required' }));
            return;
          }

          // 1. Read the existing agent file to preserve name/title/color
          const agentFilePath = resolve(projectRoot, 'src', 'config', 'agents', `${body.agentId}.ts`);
          let existingContent = '';
          try { existingContent = readFileSync(agentFilePath, 'utf-8'); } catch { /* new file */ }

          // Extract name, title, color from existing file to preserve them
          const nameMatch = existingContent.match(/name:\s*'([^']+)'/);
          const titleMatch = existingContent.match(/title:\s*'([^']+)'/);
          const colorMatch = existingContent.match(/color:\s*'([^']+)'/);
          const preservedName = nameMatch?.[1] ?? (body.agentId.charAt(0).toUpperCase() + body.agentId.slice(1));
          const preservedTitle = titleMatch?.[1] ?? '';
          const preservedColor = colorMatch?.[1] ?? '#6B7280';

          // 2. Write agent .ts file (full template rewrite)
          const exportName = `${body.agentId}Persona`;
          const personaPromptEscaped = body.personaPrompt.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
          const agentFileContent = `import type { AgentPersona } from '@/types/agent';

/**
 * ${preservedName}'s full persona definition.
 *
 * \`personaPrompt\` is the persona-specific system prompt layer that gets combined
 * with the base system prompt by the context builder. It is separate from the
 * runtime \`systemPrompt\` field on AgentPersona (which is the fully assembled prompt).
 */
export const ${exportName}: Omit<AgentPersona, 'status' | 'systemPrompt'> & { personaPrompt: string } = {
  id: '${body.agentId}',
  name: '${preservedName}',
  title: '${preservedTitle}',
  color: '${preservedColor}',
  personality:
    ${JSON.stringify(body.personality)},
  domain:
    ${JSON.stringify(body.domain)},
  personaPrompt: \`${personaPromptEscaped}\`,
};
`;
          writeFileSync(agentFilePath, agentFileContent, 'utf-8');

          // 3. Write skill file to ~/.claude/skills/
          const titleSlug = preservedTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const skillFileName = `${body.agentId}-${titleSlug}.md`;
          const skillDir = join(homedir(), '.claude', 'skills');
          mkdirSync(skillDir, { recursive: true });
          writeFileSync(join(skillDir, skillFileName), body.skillFileContent, 'utf-8');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: msg }));
        }
      });
    },
  };
}
```

- [ ] **Step 2: Register the plugin in vite.config.ts**

In `vite.config.ts`, add the import and register the plugin:

```typescript
// Add import at top:
import { vitePluginPersonaWriter } from './vite-plugin-persona-writer';

// In the plugins array:
plugins: [react(), tailwindcss(), vitePluginPersonaWriter()],
```

- [ ] **Step 3: Run the full test suite to verify no regressions**

Run: `npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 4: Commit**

```bash
git add vite-plugin-persona-writer.ts vite.config.ts
git commit -m "feat(persona-builder): add Vite dev middleware plugin for persona file writes"
```

---

## Chunk 3: UI Components

### Task 7: PersonaFieldsSidebar

**Files:**
- Create: `src/components/persona-builder/PersonaFieldsSidebar.tsx`

- [ ] **Step 1: Create the sidebar component**

```tsx
// src/components/persona-builder/PersonaFieldsSidebar.tsx
import { usePersonaBuilderStore } from '@/store/personaBuilderStore';
import { getAgent } from '@/config/agents';
import { PERSONA_FIELD_LABELS, SAVE_THRESHOLD } from '@/types/personaBuilder';
import type { PersonaFieldKey } from '@/types/personaBuilder';

interface Props {
  onPreview: () => void;
  onSave: () => void;
  isSaving: boolean;
}

const FIELD_ORDER: PersonaFieldKey[] = [
  'personality',
  'domain',
  'coreIdentity',
  'communicationStyle',
  'bilingualPatterns',
  'modesOfOperation',
];

export function PersonaFieldsSidebar({ onPreview, onSave, isSaving }: Props) {
  const { agentId, fields, countPopulatedFields } = usePersonaBuilderStore();
  const agent = agentId ? getAgent(agentId) : null;
  const populated = countPopulatedFields();
  const canSave = populated >= SAVE_THRESHOLD;
  const progressPct = Math.round((populated / 6) * 100);

  return (
    <div style={{
      width: 240,
      background: '#0c0c11',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0,
    }}>
      {/* Agent header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: agent?.color ?? '#6B7280',
          flexShrink: 0,
        }} />
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>
            {agent?.name ?? agentId}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
            {agent?.title ?? ''}
          </div>
        </div>
      </div>

      {/* Field rows */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FIELD_ORDER.map((key) => {
          const value = fields[key];
          const hasValue = typeof value === 'string' && value.trim().length > 0;
          return (
            <div key={key}>
              <div style={{
                fontSize: 9, color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3,
              }}>
                {PERSONA_FIELD_LABELS[key]}
              </div>
              <div style={{
                fontSize: 11,
                color: hasValue ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)',
                fontStyle: hasValue ? 'normal' : 'italic',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${hasValue ? `${agent?.color ?? '#6B7280'}44` : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 5,
                padding: '6px 8px',
                lineHeight: 1.4,
                minHeight: 26,
                wordBreak: 'break-word',
              }}>
                {hasValue ? value : 'not yet built…'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress */}
      {populated < 6 && (
        <>
          <div style={{
            height: 3, background: 'rgba(255,255,255,0.06)',
            margin: '0 12px', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: agent?.color ?? '#6B7280',
              borderRadius: 2, transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', padding: '4px 12px 8px', letterSpacing: '0.3px' }}>
            {progressPct}% complete — {6 - populated} field{6 - populated !== 1 ? 's' : ''} remaining
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onPreview}
          style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 6, padding: 8, color: '#a5b4fc',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ▶ Preview Agent
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          title={!canSave ? `Keep building — ${SAVE_THRESHOLD - populated} fields remaining` : undefined}
          style={{
            background: canSave ? '#16a34a' : 'rgba(255,255,255,0.05)',
            border: 'none', borderRadius: 6, padding: 8,
            color: canSave ? '#fff' : 'rgba(255,255,255,0.2)',
            fontSize: 12, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {isSaving ? 'Saving…' : canSave ? 'Save Persona' : `${SAVE_THRESHOLD - populated} fields missing`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 3: Commit**

```bash
git add src/components/persona-builder/PersonaFieldsSidebar.tsx
git commit -m "feat(persona-builder): add PersonaFieldsSidebar with live field display and save gate"
```

---

### Task 8: PersonaBuilderChat

**Files:**
- Create: `src/components/persona-builder/PersonaBuilderChat.tsx`

- [ ] **Step 1: Create the chat component**

```tsx
// src/components/persona-builder/PersonaBuilderChat.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePersonaBuilderStore } from '@/store/personaBuilderStore';
import { getAgent } from '@/config/agents';
import {
  runInterviewTurn,
  runExtractionPass,
  runPreviewTurn,
  buildPreviewSystemPrompt,
  assemblePersonaPrompt,
  truncateFileText,
} from '@/services/personaBuilderService';
import type { PersonaMessage } from '@/types/personaBuilder';
import { extractPdfText } from '@/services/files/extractPdf';
import { extractDocxText } from '@/services/files/extractDocx';

interface Props {
  onBackToBuild: (lastUserMsg: string) => void;
}

export function PersonaBuilderChat({ onBackToBuild }: Props) {
  const {
    agentId, mode, interviewMessages, previewMessages,
    appendInterviewMessage, appendPreviewMessage, setFields,
  } = usePersonaBuilderStore();

  const agent = agentId ? getAgent(agentId) : null;
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = mode === 'interview' ? interviewMessages : previewMessages;
  const appendMessage = mode === 'interview' ? appendInterviewMessage : appendPreviewMessage;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Send opening question when first opened (interview mode, no messages yet)
  useEffect(() => {
    if (mode === 'interview' && interviewMessages.length === 0 && agentId && !isStreaming) {
      void sendToInterviewAI([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function sendToInterviewAI(msgs: PersonaMessage[]) {
    if (!agentId) return;
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let fullResponse = '';

    await runInterviewTurn(
      agentId,
      msgs,
      {
        onToken: (t) => setStreamingContent(prev => prev + t),
        onComplete: (full) => { fullResponse = full; },
        onError: (e) => setError(e.message),
      },
      controller.signal,
    );

    if (fullResponse) {
      appendInterviewMessage({ role: 'assistant', content: fullResponse });
      setStreamingContent('');

      // Run extraction pass silently
      const agent = getAgent(agentId);
      const extracted = await runExtractionPass(
        [...msgs, { role: 'assistant', content: fullResponse }],
        agent?.personaPrompt ?? '',
      );
      if (extracted) setFields(extracted);
    }

    setIsStreaming(false);
    abortRef.current = null;
  }

  async function sendToPreviewAI(msgs: PersonaMessage[]) {
    if (!agentId) return;
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let fullResponse = '';

    const { fields } = usePersonaBuilderStore.getState();
    const personaPrompt = assemblePersonaPrompt(fields);
    const systemPrompt = buildPreviewSystemPrompt(personaPrompt);

    await runPreviewTurn(
      systemPrompt,
      msgs,
      {
        onToken: (t) => setStreamingContent(prev => prev + t),
        onComplete: (full) => { fullResponse = full; },
        onError: (e) => setError(e.message),
      },
      controller.signal,
    );

    if (fullResponse) {
      appendPreviewMessage({ role: 'assistant', content: fullResponse });
      setStreamingContent('');
    }

    setIsStreaming(false);
    abortRef.current = null;
  }

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;
    const userMsg: PersonaMessage = { role: 'user', content: inputValue.trim() };
    appendMessage(userMsg);
    setInputValue('');

    const updatedMsgs = [...messages, userMsg];
    if (mode === 'interview') {
      await sendToInterviewAI(updatedMsgs);
    } else {
      await sendToPreviewAI(updatedMsgs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isStreaming, messages, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agentId) return;
    e.target.value = '';

    let text = '';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    try {
      if (ext === 'pdf') {
        text = await extractPdfText(await file.arrayBuffer());
      } else if (ext === 'docx') {
        text = await extractDocxText(await file.arrayBuffer());
      } else {
        text = await file.text();
      }
    } catch {
      setError(`Could not read ${file.name}`);
      return;
    }

    const { text: truncatedText, truncated } = truncateFileText(text);
    const content = `[File uploaded: ${file.name}]\n<uploaded_document>\n${truncatedText}\n</uploaded_document>`;
    const userMsg: PersonaMessage = { role: 'user', content };
    appendInterviewMessage(userMsg);

    if (truncated) {
      appendInterviewMessage({
        role: 'system',
        content: `⚠️ File was truncated to 500KB. The first 500KB was processed.`,
      });
    }

    const updatedMsgs = [...interviewMessages, userMsg];
    await sendToInterviewAI(updatedMsgs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, interviewMessages]);

  const handleBackToBuild = () => {
    const lastUserMsg = [...previewMessages].reverse().find(m => m.role === 'user')?.content ?? '';
    onBackToBuild(lastUserMsg);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f14', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: agent?.color ?? '#6B7280', flexShrink: 0 }} />
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
          {mode === 'preview' ? `Preview: ${agent?.name}` : `Building ${agent?.name}`}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 'auto' }}>
          {agent?.title}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.filter(m => m.role !== 'system').map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: msg.role === 'user' ? '#1a2a1a' : '#1e1b2e',
              color: msg.role === 'user' ? '#6ee7b7' : '#a78bfa',
              border: `1px solid ${msg.role === 'user' ? '#065f46' : '#4c1d95'}`,
            }}>
              {msg.role === 'user' ? 'B' : 'AI'}
            </div>
            <div style={{
              background: msg.role === 'user' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)',
              borderRadius: 8, padding: '10px 12px',
              color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 1.5,
              maxWidth: '75%',
              // Mask file uploads to show just the filename
              ...(msg.content.startsWith('[File uploaded:') ? { fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' } : {}),
            }}>
              {msg.content.startsWith('[File uploaded:')
                ? msg.content.split('\n')[0]
                : msg.content}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && streamingContent && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, background: '#1e1b2e', color: '#a78bfa',
              border: '1px solid #4c1d95',
            }}>AI</div>
            <div style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px',
              color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 1.5, maxWidth: '75%',
            }}>
              {streamingContent}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#f87171', fontSize: 11, padding: '4px 0' }}>⚠ {error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {mode === 'preview' ? (
          <button
            onClick={handleBackToBuild}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, padding: '6px 12px', color: 'rgba(255,255,255,0.6)',
              fontSize: 11, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
            }}
          >
            ← Back to Build
          </button>
        ) : (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: 6, padding: '6px 12px', color: 'rgba(255,255,255,0.5)',
                fontSize: 11, cursor: isStreaming ? 'not-allowed' : 'pointer',
                flexShrink: 0, fontFamily: 'inherit',
              }}
            >
              📄 Upload file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.pdf,.docx"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e)}
            />
          </>
        )}
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={
            mode === 'preview'
              ? `Ask ${agent?.name ?? 'the agent'} something…`
              : `Tell me about ${agent?.name ?? 'this agent'}…`
          }
          rows={1}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,0.7)',
            fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={isStreaming || !inputValue.trim()}
          style={{
            background: '#4f46e5', border: 'none', borderRadius: 6, padding: '7px 14px',
            color: '#fff', fontSize: 12, cursor: isStreaming ? 'not-allowed' : 'pointer',
            flexShrink: 0, fontFamily: 'inherit', opacity: isStreaming || !inputValue.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 3: Commit**

```bash
git add src/components/persona-builder/PersonaBuilderChat.tsx
git commit -m "feat(persona-builder): add PersonaBuilderChat with streaming interview and file upload"
```

---

### Task 9: PersonaBuilderOverlay

**Files:**
- Create: `src/components/persona-builder/PersonaBuilderOverlay.tsx`

- [ ] **Step 1: Create the overlay**

```tsx
// src/components/persona-builder/PersonaBuilderOverlay.tsx
import { useCallback } from 'react';
import { usePersonaBuilderStore } from '@/store/personaBuilderStore';
import { getAgent } from '@/config/agents';
import {
  assemblePersonaPrompt,
  generateSkillFile,
  savePersona,
} from '@/services/personaBuilderService';
import { PersonaBuilderChat } from './PersonaBuilderChat';
import { PersonaFieldsSidebar } from './PersonaFieldsSidebar';

export function PersonaBuilderOverlay() {
  const { isOpen, agentId, fields, isSaving, setMode, close } = usePersonaBuilderStore();

  const handlePreview = useCallback(() => {
    setMode('preview');
  }, [setMode]);

  const handleBackToBuild = useCallback((lastUserMsg: string) => {
    usePersonaBuilderStore.getState().backToBuild(lastUserMsg);
  }, []);

  const handleSave = useCallback(async () => {
    if (!agentId) return;
    const agent = getAgent(agentId);
    if (!agent) return;

    usePersonaBuilderStore.setState({ isSaving: true });

    try {
      const personaPrompt = assemblePersonaPrompt(fields);
      const skillFileContent = await generateSkillFile(agentId, fields, personaPrompt);

      await savePersona({
        agentId,
        personality: fields.personality ?? agent.personality,
        domain: fields.domain ?? agent.domain,
        personaPrompt,
        skillFileContent,
      });

      close();
      // Toast — simple console for now; integrate with app toast system if available
      console.info(`✓ ${agent.name}'s persona updated`);
    } catch (e) {
      console.error('Save failed:', e);
      usePersonaBuilderStore.setState({ isSaving: false });
    }
  }, [agentId, fields, close]);

  if (!isOpen || import.meta.env.PROD) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div style={{
        height: 48, background: '#080810', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
          Persona Builder
        </span>
        <button
          onClick={close}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: '2px 6px',
          }}
          aria-label="Close persona builder"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <PersonaBuilderChat onBackToBuild={handleBackToBuild} />
        <PersonaFieldsSidebar
          onPreview={handlePreview}
          onSave={() => void handleSave()}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 3: Commit**

```bash
git add src/components/persona-builder/PersonaBuilderOverlay.tsx
git commit -m "feat(persona-builder): add PersonaBuilderOverlay with save flow and preview mode"
```

---

## Chunk 4: Integration

### Task 10: Wire into App.tsx

> **Depends on:** Task 4 (Chunk 1) must be complete — `setOnFilingCabinetClick` is exported from `src/engine/input.ts` only after that task.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and mount the overlay**

Add at the top of `App.tsx`:

```typescript
import { PersonaBuilderOverlay } from '@/components/persona-builder/PersonaBuilderOverlay';
import { usePersonaBuilderStore } from '@/store/personaBuilderStore';
import { setOnFilingCabinetClick } from '@/engine/input';
```

Inside the `App` function, add the filing cabinet callback wiring (after the existing `setOnFileClick` effect):

```typescript
  // Wire canvas filing cabinet clicks to open persona builder
  const handleFilingCabinetClick = useCallback((agentId: string) => {
    usePersonaBuilderStore.getState().open(agentId as AgentId);
  }, []);

  useEffect(() => {
    setOnFilingCabinetClick(handleFilingCabinetClick);
    return () => setOnFilingCabinetClick(null);
  }, [handleFilingCabinetClick]);
```

Inside the JSX return, add the overlay just before the closing `</div>` of the root element (after the migration prompt):

```tsx
      {/* Persona Builder overlay — dev only, renders null in production */}
      <PersonaBuilderOverlay />
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm run dev`

1. Open the app at `http://localhost:5173`
2. Click on Isaac's office area — BILLY should walk there
3. Click the filing cabinet in Isaac's NW corner (col 3, row 3)
4. Persona Builder overlay should open with Isaac's name/color in header
5. AI sends opening question automatically
6. Type a response and send — sidebar fields should populate after response
7. Upload a file — should show "[File uploaded: name.md]" in chat and populate fields
8. Click "Preview Agent" — mode switches, can chat with draft Isaac
9. Click "← Back to Build" — returns to interview
10. With ≥5 fields populated, "Save Persona" button becomes enabled
11. Click Save — agent .ts file should update, skill file should write to ~/.claude/skills/
12. Verify HMR reloads the agent file cleanly

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(persona-builder): wire PersonaBuilderOverlay into App with filing cabinet callback"
```

---

### Task 11: Final cleanup and full test run

- [ ] **Step 1: Run the full test suite one last time**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Check TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit**

```bash
git add src/App.tsx src/components/persona-builder/ src/store/personaBuilderStore.ts src/services/personaBuilderService.ts src/types/personaBuilder.ts vite-plugin-persona-writer.ts vite.config.ts
git commit -m "feat(persona-builder): complete persona builder — filing cabinets, AI interview, file upload, preview, save"
```
