import type { AgentId } from '@/types/agent';
import type { MemoryFact, MemoryCategory } from '@/types/memory';
import { getAnthropicClient } from '@/services/anthropic/client';
import { DEFAULT_MODEL } from '@/services/context/tokenCounter';
import { useMemoryStore } from '@/store/memoryStore';

export const MEMORY_EXTRACTION_PROMPT = `You extract structured facts from conversations about film/television production deals.

Given a conversation exchange between a user (Billy, CEO) and an advisor, extract key facts as a JSON array.

Categories:
- "decision": Explicit decisions or commitments made
- "financial": Dollar amounts, budgets, percentages, financial metrics (IRR, MOIC, hurdle rates)
- "date": Dates, deadlines, timelines
- "action-item": Tasks, next steps, things to follow up on
- "entity": People, companies, organizations, projects mentioned
- "assumption": Assumptions being made in analysis
- "risk": Risks, concerns, potential problems identified
- "term": Deal terms, contract terms, legal structures

Rules:
- Output ONLY a JSON array. No markdown fences. No explanation.
- Each object: { "category": string, "content": string, "confidence": "high"|"medium"|"low" }
- "content" should be a concise factual statement (1-2 sentences max)
- Only extract NEW facts from this exchange. Do not extract facts that were clearly injected as prior context.
- If no new facts are present, output an empty array: []
- "high" confidence: explicitly stated numbers, dates, or decisions
- "medium" confidence: implied or discussed but not finalized
- "low" confidence: speculative or conditional

Example output:
[
  {"category":"financial","content":"Production budget is $2.4M USD with 60/40 MXN/USD split","confidence":"high"},
  {"category":"date","content":"EFICINE application deadline is April 30, 2026","confidence":"high"},
  {"category":"action-item","content":"Need to send term sheet to Videocine by end of week","confidence":"medium"}
]`;

interface ExtractedFact {
  category: MemoryCategory;
  content: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculates word overlap ratio between two strings.
 * Returns the fraction of words in the shorter string that appear in the longer one.
 */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const smaller = wordsA.size <= wordsB.size ? wordsA : wordsB;
  const larger = wordsA.size > wordsB.size ? wordsA : wordsB;

  if (smaller.size === 0) return 0;

  let matches = 0;
  for (const word of smaller) {
    if (larger.has(word)) matches++;
  }
  return matches / smaller.size;
}

/**
 * Strips markdown code fences from a string, returning the inner content.
 */
function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return fenceMatch ? fenceMatch[1]! : text;
}

/**
 * Extracts structured facts from a conversation exchange and stores them in memory.
 *
 * Fire-and-forget safe: never throws, logs warnings on failure.
 */
export async function extractAndStoreMemory(
  agentId: AgentId,
  userMessage: string,
  assistantMessage: string,
  dealId: string,
): Promise<void> {
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: MEMORY_EXTRACTION_PROMPT,
      messages: [{
        role: 'user',
        content: `USER: ${userMessage}\n\nASSISTANT: ${assistantMessage}`,
      }],
    });

    const text = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => ('text' in b ? b.text : ''))
      .join('');

    let facts: ExtractedFact[];
    try {
      facts = JSON.parse(text);
    } catch {
      // Try stripping markdown code fences
      const stripped = stripCodeFences(text);
      facts = JSON.parse(stripped);
    }

    if (!Array.isArray(facts) || facts.length === 0) return;

    const now = Date.now();
    const { addFacts, facts: existingFacts } = useMemoryStore.getState();

    // Filter to same agent + deal for dedup comparison
    const agentDealFacts = existingFacts.filter(
      (f) => f.agentId === agentId && f.dealId === dealId,
    );

    const newFacts: MemoryFact[] = [];

    for (const extracted of facts) {
      // Check for dedup: same category + >50% word overlap
      const duplicate = agentDealFacts.find(
        (existing) =>
          existing.category === extracted.category &&
          wordOverlap(existing.content, extracted.content) > 0.5,
      );

      if (duplicate) {
        // Update existing fact's timestamp instead of adding new
        newFacts.push({
          ...duplicate,
          updatedAt: now,
        });
      } else {
        // Add as new fact
        newFacts.push({
          id: crypto.randomUUID(),
          agentId,
          dealId,
          category: extracted.category,
          content: extracted.content,
          confidence: extracted.confidence,
          sourceAgentId: agentId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (newFacts.length > 0) {
      await addFacts(newFacts);
    }
  } catch {
    // Extraction failure is non-fatal -- log and continue
    console.warn('Memory extraction failed for', agentId);
  }
}
