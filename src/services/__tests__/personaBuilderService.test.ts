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

  it('returns null when JSON is valid but missing required fields', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{}' }],
    });
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
