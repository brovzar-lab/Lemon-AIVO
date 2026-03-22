import { useCollaborationStore } from '@/store/collaborationStore';
import { getAgent } from '@/config/agents';
import type { CollabHop } from '@/types/collaboration';

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--text-secondary)',
  approved: 'var(--accent-gold)',
  skipped: 'var(--text-secondary)',
  completed: 'var(--status-working)',
  failed: 'var(--accent-coral)',
  walking: 'var(--accent-gold)',
  'running-hop': 'var(--status-meeting)',
};

function HopCard({
  hop,
  isLive,
  liveOutput,
}: {
  hop: CollabHop;
  isLive: boolean;
  liveOutput: string;
}) {
  const agent = getAgent(hop.toAgentId);
  const agentColor = agent?.color ?? 'var(--text-secondary)';
  const statusLabel = isLive ? 'running' : hop.status;

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 10px',
      marginBottom: 6,
      backgroundColor: 'var(--bg-card)',
      borderLeft: isLive ? '3px solid var(--accent-gold)' : undefined,
      animation: 'fadeSlideIn 0.3s ease-out',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{
          color: agentColor,
          fontWeight: 700,
          fontSize: 10,
          fontFamily: 'var(--font-pixel)',
        }}>
          {agent?.name ?? hop.toAgentId}
        </span>
        <span style={{
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: STATUS_COLORS[statusLabel] ?? 'var(--text-secondary)',
          fontFamily: 'var(--font-pixel)',
        }}>
          {statusLabel}
        </span>
      </div>
      <div style={{
        fontSize: 9,
        color: 'var(--text-secondary)',
        marginBottom: 4,
        fontStyle: 'italic',
      }}>
        {hop.reason}
      </div>
      {isLive && liveOutput && (
        <div style={{
          fontSize: 9,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          maxHeight: 100,
          overflowY: 'auto',
          lineHeight: 1.5,
          scrollbarWidth: 'thin' as const,
        }}>
          {liveOutput}
          <span style={{ opacity: 0.6, animation: 'livePulse 1.5s ease-in-out infinite' }}>|</span>
        </div>
      )}
      {!isLive && hop.result && (
        <div style={{
          fontSize: 9,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
          maxHeight: 160,
          overflowY: 'auto',
          scrollbarWidth: 'thin' as const,
        }}>
          {hop.result}
        </div>
      )}
    </div>
  );
}

export function CollaborationPanel({ onStartNew }: { onStartNew: () => void }) {
  const activeChain = useCollaborationStore(s => s.activeChain);
  const liveOutput = useCollaborationStore(s => s.liveOutput);
  const viewMode = useCollaborationStore(s => s.viewMode);
  const setViewMode = useCollaborationStore(s => s.setViewMode);
  const abortChain = useCollaborationStore(s => s.abortChain);

  if (!activeChain) {
    return (
      <div style={{
        padding: 16,
        color: 'var(--text-secondary)',
        fontSize: 9,
        textAlign: 'center',
      }}>
        <p>No active collaboration.</p>
        <button
          onClick={onStartNew}
          style={{
            marginTop: 8,
            padding: '6px 14px',
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
          START COLLAB
        </button>
      </div>
    );
  }

  const originAgent = getAgent(activeChain.originAgentId);
  const isRunning =
    activeChain.status === 'walking' ||
    activeChain.status === 'running-hop' ||
    activeChain.status === 'awaiting-approval';
  const currentHopIndex = activeChain.hops.findIndex(
    h => h.status === 'pending' || h.status === 'approved',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: 7,
            color: 'var(--accent-gold)',
            fontFamily: 'var(--font-pixel)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 2,
          }}>
            {originAgent?.name ?? activeChain.originAgentId} → CHAIN
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {activeChain.initialTask.slice(0, 50)}
            {activeChain.initialTask.length > 50 ? '...' : ''}
          </div>
        </div>
        {isRunning && (
          <button
            onClick={() => abortChain('User stopped chain')}
            style={{
              padding: '3px 8px',
              backgroundColor: 'rgba(192, 96, 80, 0.15)',
              border: '1px solid var(--accent-coral)',
              borderRadius: 4,
              color: 'var(--accent-coral)',
              cursor: 'pointer',
              fontSize: 7,
              fontFamily: 'var(--font-pixel)',
              letterSpacing: 1,
            }}
          >
            STOP
          </button>
        )}
      </div>

      {/* View mode toggle */}
      {isRunning && (
        <div style={{
          padding: '4px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 6,
          flexShrink: 0,
        }}>
          {(['live', 'background'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '2px 8px',
                fontSize: 7,
                fontFamily: 'var(--font-pixel)',
                border: `1px solid ${viewMode === mode ? 'var(--accent-gold)' : 'var(--border)'}`,
                backgroundColor: viewMode === mode ? 'rgba(192, 160, 96, 0.1)' : 'transparent',
                color: viewMode === mode ? 'var(--accent-gold)' : 'var(--text-secondary)',
                borderRadius: 3,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      )}

      {/* Hop timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin' as const }}>
        {activeChain.hops.map((hop, i) => (
          <HopCard
            key={hop.hopIndex}
            hop={hop}
            isLive={i === currentHopIndex && activeChain.status === 'running-hop'}
            liveOutput={liveOutput}
          />
        ))}
        {activeChain.status === 'awaiting-approval' && (
          <div style={{
            textAlign: 'center',
            color: 'var(--accent-gold)',
            fontSize: 7,
            fontFamily: 'var(--font-pixel)',
            padding: 8,
            letterSpacing: 1,
            animation: 'livePulse 1.5s ease-in-out infinite',
          }}>
            APPROVAL PENDING
          </div>
        )}
      </div>

      {/* Completion footer */}
      {(activeChain.status === 'completed' || activeChain.status === 'aborted') && (
        <div style={{ padding: 10, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{
            fontSize: 7,
            color: activeChain.status === 'completed' ? 'var(--status-working)' : 'var(--accent-coral)',
            fontFamily: 'var(--font-pixel)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}>
            {activeChain.status === 'completed' ? 'CHAIN COMPLETE' : 'CHAIN STOPPED'}
          </div>
          <button
            onClick={onStartNew}
            style={{
              width: '100%',
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
        </div>
      )}
    </div>
  );
}
