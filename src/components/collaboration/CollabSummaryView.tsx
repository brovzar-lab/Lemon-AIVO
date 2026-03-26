import { useCollaborationStore } from '@/store/collaborationStore';
import { getAgent } from '@/config/agents';
import type { ChainSnapshot } from '@/types/collaboration';

export function CollabSummaryView({
  onStartNew,
  chain: chainProp,
}: {
  onStartNew?: () => void;
  chain?: ChainSnapshot;
}) {
  const activeChain = useCollaborationStore((s) => s.activeChain);
  const displayChain = chainProp ?? activeChain;

  if (!displayChain) return null;

  const completedHops = displayChain.hops.filter(
    (h) => h.status === 'completed' && h.result,
  );

  async function copyResult(text: string) {
    await navigator.clipboard.writeText(text).catch(() => { /* no-op */ });
  }

  return (
    <div data-testid="collab-summary-view" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="section-title" style={{ color: 'var(--accent-gold)' }}>
        SUMMARY
      </div>

      {displayChain.summary && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 9,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          border: '1px solid var(--border)',
        }}>
          {displayChain.summary}
        </div>
      )}

      <div>
        <div style={{
          fontSize: 7,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-pixel)',
          letterSpacing: 1,
          marginBottom: 6,
        }}>
          {completedHops.length} HOP{completedHops.length !== 1 ? 'S' : ''} COMPLETED
        </div>
        {completedHops.map((hop) => {
          const agent = getAgent(hop.toAgentId);
          return (
            <div key={hop.hopIndex} style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 6,
              backgroundColor: 'var(--bg-card)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}>
                <span style={{
                  color: agent?.color ?? 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 10,
                  fontFamily: 'var(--font-pixel)',
                }}>
                  {agent?.name ?? hop.toAgentId}
                </span>
                <button
                  onClick={() => copyResult(hop.result ?? '')}
                  title="Copy result"
                  style={{
                    padding: '2px 6px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 7,
                    fontFamily: 'var(--font-pixel)',
                    letterSpacing: 1,
                  }}
                >
                  COPY
                </button>
              </div>
              <div style={{
                fontSize: 9,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {hop.result}
              </div>
            </div>
          );
        })}
      </div>

      {!chainProp && onStartNew && (
        <button
          onClick={onStartNew}
          style={{
            padding: '6px 0',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--accent-gold)',
            borderRadius: 4,
            color: 'var(--accent-gold)',
            cursor: 'pointer',
            fontSize: 7,
            fontFamily: 'var(--font-pixel)',
            letterSpacing: 1,
          }}
        >
          NEW COLLAB
        </button>
      )}
    </div>
  );
}
