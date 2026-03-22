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
      console.info(`✓ ${agent.name}'s persona updated`);
    } catch (e) {
      console.error('Save failed:', e);
      usePersonaBuilderStore.setState({ isSaving: false });
    }
  }, [agentId, fields, close]);

  if (!isOpen) return null;

  return (
    <div className="persona-overlay" style={{ flexDirection: 'column' }}>
      {/* Top bar */}
      <div className="persona-chat-header" style={{
        height: 48, background: 'var(--bg-dark)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, width: '100%',
      }}>
        <span className="persona-chat-mode">Persona Builder</span>
        <button
          onClick={close}
          className="modal-close"
          style={{ marginLeft: 'auto' }}
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
