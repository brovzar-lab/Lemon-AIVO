import { useShallow } from 'zustand/react/shallow';
import { useMemoryStore } from '@/store/memoryStore';
import { useDealStore } from '@/store/dealStore';
import { getAgent } from '@/config/agents';
import type { AgentId } from '@/types/agent';
import type { MemoryFact, MemoryCategory } from '@/types/memory';

interface MemoryPanelProps {
  agentId: AgentId;
  onClose: () => void;
}

const CATEGORY_CONFIG: Record<MemoryCategory, { emoji: string; label: string }> = {
  decision: { emoji: '✅', label: 'DECISION' },
  financial: { emoji: '💲', label: 'FINANCIAL' },
  date: { emoji: '📅', label: 'DATE' },
  'action-item': { emoji: '➡️', label: 'ACTION' },
  entity: { emoji: '🏢', label: 'ENTITY' },
  assumption: { emoji: '❓', label: 'ASSUMPTION' },
  risk: { emoji: '⚠️', label: 'RISK' },
  term: { emoji: '📄', label: 'TERM' },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'var(--status-working)',
  medium: 'var(--accent-gold)',
  low: 'var(--accent-coral)',
};

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function groupByCategory(facts: MemoryFact[]): Map<MemoryCategory, MemoryFact[]> {
  const groups = new Map<MemoryCategory, MemoryFact[]>();
  for (const fact of facts) {
    const existing = groups.get(fact.category);
    if (existing) existing.push(fact);
    else groups.set(fact.category, [fact]);
  }
  return groups;
}

export function MemoryPanel({ agentId, onClose }: MemoryPanelProps) {
  const activeDealId = useDealStore((s) => s.activeDealId);
  const facts = useMemoryStore(
    useShallow((s) => s.facts.filter((f) => f.agentId === agentId && f.dealId === activeDealId))
  );
  const isExtracting = useMemoryStore((s) => s.isExtracting);
  const agent = getAgent(agentId);
  const agentName = agent?.name ?? agentId;
  const grouped = groupByCategory(facts);

  function handleDelete(factId: string): void {
    useMemoryStore.getState().removeFact(factId);
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-panel)', color: 'var(--text-primary)',
      animation: 'fadeSlideIn 0.2s ease-out',
    }} data-testid="memory-panel">
      {/* Header */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <h2 style={{
          flex: 1, margin: 0, fontSize: 8, fontFamily: 'var(--font-pixel)',
          color: 'var(--accent-gold)', letterSpacing: 1,
        }}>
          MEMORY · {agentName.toUpperCase()}
        </h2>
        {isExtracting && (
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--accent-gold)',
            letterSpacing: 1, animation: 'livePulse 1.5s ease-in-out infinite',
          }}>
            EXTRACTING...
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', scrollbarWidth: 'thin' as const }}>
        {facts.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">🧠</div>
            <h3>NO MEMORIES YET</h3>
            <p>Chat with {agentName} to build knowledge</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from(grouped.entries()).map(([category, categoryFacts]) => {
              const config = CATEGORY_CONFIG[category];
              return (
                <section key={category}>
                  <h3 style={{
                    fontSize: 7, fontFamily: 'var(--font-pixel)', fontWeight: 600,
                    color: 'var(--text-secondary)', textTransform: 'uppercase',
                    letterSpacing: 1, marginBottom: 6, margin: 0, marginTop: 0,
                  }}>
                    {config.emoji} {config.label}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {categoryFacts.map((fact) => (
                      <div key={fact.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                        background: 'var(--bg-card)', borderRadius: 4,
                        padding: '6px 8px', border: '1px solid var(--border)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 9, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                            {fact.content}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{
                              fontSize: 7, fontFamily: 'var(--font-pixel)', fontWeight: 600,
                              padding: '1px 5px', borderRadius: 6,
                              color: 'var(--text-bright)',
                              backgroundColor: CONFIDENCE_COLORS[fact.confidence],
                              letterSpacing: 1,
                            }}>
                              {fact.confidence.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)', letterSpacing: 1 }}>
                              {relativeTime(fact.createdAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(fact.id)}
                          style={{
                            color: 'var(--text-secondary)', background: 'transparent',
                            border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0,
                            transition: 'color 0.15s',
                          }}
                          aria-label="Delete"
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '6px 0',
            fontSize: 7, fontFamily: 'var(--font-pixel)', fontWeight: 600,
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer',
            letterSpacing: 1, transition: 'background 0.15s',
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
