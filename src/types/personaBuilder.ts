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
