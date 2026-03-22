// src/services/personaBuilderService.ts
import { getAnthropicClient } from '@/services/anthropic/client';
import type { PersonaMessage, ExtractedPersonaFields } from '@/types/personaBuilder';
import type { AgentId } from '@/types/agent';
import { getAgent } from '@/config/agents/index';
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
 * Streams a meta-AI interview response.
 * Caller iterates tokens via callbacks.
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

  // Anthropic API requires at least one message — on the opening turn inject a
  // silent kickoff so the meta-AI produces the first interview question.
  const finalMessages = apiMessages.length > 0
    ? apiMessages
    : [{ role: 'user' as const, content: 'Please start the interview.' }];

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildInterviewSystemPrompt(agentId),
      messages: finalMessages,
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
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => ('text' in b ? b.text : ''))
      .join('');

    const parsed = JSON.parse(text) as ExtractedPersonaFields | null;
    // Basic validation: must be an object with at least personality or coreIdentity
    if (parsed === null || typeof parsed !== 'object' || (!parsed.personality && !parsed.coreIdentity)) {
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
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => ('text' in b ? b.text : ''))
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
  // Strip trailing replacement characters from partial multi-byte sequences
  const truncated = new TextDecoder().decode(bytes.slice(0, MAX_FILE_BYTES)).replace(/\uFFFD+$/, '');
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
