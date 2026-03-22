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
    <div className="persona-sidebar" style={{ flexShrink: 0 }}>
      {/* Agent header */}
      <div className="persona-sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: agent?.color ?? '#6B7280', flexShrink: 0,
        }} />
        <div>
          <div className="persona-sidebar-title">{agent?.name ?? agentId}</div>
          <div className="persona-sidebar-subtitle">{agent?.title ?? ''}</div>
        </div>
      </div>

      {/* Field rows */}
      <div className="persona-fields">
        {FIELD_ORDER.map((key) => {
          const value = fields[key];
          const hasValue = typeof value === 'string' && value.trim().length > 0;
          return (
            <div key={key} className={`persona-field ${hasValue ? 'filled' : 'empty'}`}
              style={hasValue ? {
                background: `${agent?.color ?? '#6B7280'}12`,
                borderColor: `${agent?.color ?? '#6B7280'}44`,
              } : undefined}
            >
              <div className="persona-field-name">{PERSONA_FIELD_LABELS[key]}</div>
              <div className="persona-field-value"
                style={hasValue ? undefined : { fontStyle: 'italic', color: 'var(--text-secondary)' }}
              >
                {hasValue ? value : 'not yet built…'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress */}
      {populated < 6 && (
        <>
          <div className="persona-progress-bar" style={{ margin: '0 12px' }}>
            <div className="persona-progress-fill" style={{
              width: `${progressPct}%`,
              background: agent?.color ?? '#6B7280',
            }} />
          </div>
          <div className="persona-sidebar-subtitle" style={{ padding: '4px 12px 8px' }}>
            {progressPct}% complete — {6 - populated} field{6 - populated !== 1 ? 's' : ''} remaining
          </div>
        </>
      )}

      {/* Actions */}
      <div className="modal-footer" style={{ flexDirection: 'column' }}>
        <button className="modal-btn modal-btn-primary" onClick={onPreview} style={{ width: '100%' }}>
          ▶ Preview Agent
        </button>
        <button
          className="modal-btn"
          onClick={onSave}
          disabled={!canSave || isSaving}
          title={!canSave ? `Keep building — ${SAVE_THRESHOLD - populated} fields remaining` : undefined}
          style={{
            width: '100%',
            background: canSave ? '#16a34a' : 'var(--bg-card)',
            border: canSave ? '1px solid #16a34a' : '1px solid var(--border)',
            color: canSave ? '#fff' : 'var(--text-secondary)',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {isSaving ? 'Saving…' : canSave ? 'Save Persona' : `${SAVE_THRESHOLD - populated} fields missing`}
        </button>
      </div>
    </div>
  );
}
