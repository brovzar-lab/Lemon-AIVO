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
