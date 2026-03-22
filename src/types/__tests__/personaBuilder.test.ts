import { describe, it, expect } from 'vitest';
import { PERSONA_FIELD_LABELS, SAVE_THRESHOLD } from '@/types/personaBuilder';

describe('personaBuilder types', () => {
  it('PERSONA_FIELD_LABELS contains exactly the PersonaFieldKey keys', () => {
    const expectedKeys = [
      'personality',
      'domain',
      'coreIdentity',
      'communicationStyle',
      'bilingualPatterns',
      'modesOfOperation',
    ];
    expect(Object.keys(PERSONA_FIELD_LABELS).sort()).toEqual(expectedKeys.sort());
  });

  it('SAVE_THRESHOLD is 5', () => {
    expect(SAVE_THRESHOLD).toBe(5);
  });
});
