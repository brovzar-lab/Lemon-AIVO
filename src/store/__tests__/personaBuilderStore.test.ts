// src/store/__tests__/personaBuilderStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePersonaBuilderStore } from '../personaBuilderStore';

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
