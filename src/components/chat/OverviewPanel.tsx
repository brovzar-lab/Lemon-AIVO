import { useOfficeStore } from '@/store/officeStore';
import { useChatStore } from '@/store/chatStore';
import { agents } from '@/config/agents';
import { startWalk } from '@/engine/characters';
import { OFFICE_TILE_MAP, ROOMS } from '@/engine/officeLayout';
import type { AgentStatus } from '@/types/agent';
import type { PersonaConfig } from '@/config/agents';

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

function navigateToAgent(agentId: string): void {
  const room = ROOMS.find((r) => r.id === agentId);
  if (!room) return;
  const state = useOfficeStore.getState();
  state.setTargetRoom(room.id);
  startWalk('billy', room.billyStandTile.col, room.billyStandTile.row, OFFICE_TILE_MAP);
}

function statusDotStyle(status: AgentStatus, agentColor: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  };
  switch (status) {
    case 'thinking':
      return { ...base, backgroundColor: agentColor, boxShadow: `0 0 6px ${agentColor}`, animation: 'livePulse 1.5s ease-in-out infinite' };
    case 'needs-attention':
      return { ...base, backgroundColor: 'var(--accent-coral)', boxShadow: '0 0 6px var(--accent-coral)' };
    case 'idle':
    default:
      return { ...base, backgroundColor: 'var(--status-working)', boxShadow: '0 0 4px var(--status-working)' };
  }
}

/**
 * Agent overview panel — pixel-art styled "Command Center".
 * Displayed when BILLY is at his own office.
 */
export function OverviewPanel() {
  const agentStatuses = useOfficeStore((s) => s.agentStatuses);
  const conversations = useChatStore((s) => s.conversations);
  const agentList = Object.values(agents) as PersonaConfig[];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '12px 10px',
      gap: 10,
      scrollbarWidth: 'thin' as const,
    }}>
      {/* Header */}
      <div>
        <h2 style={{
          fontSize: 9,
          fontFamily: 'var(--font-pixel)',
          color: 'var(--accent-gold)',
          letterSpacing: 2,
          marginBottom: 4,
        }}>
          COMMAND CENTER
        </h2>
        <p style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
          Your agents are standing by
        </p>
      </div>

      {/* Agent Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {agentList.map((agent) => {
          const status: AgentStatus = agentStatuses[agent.id] ?? 'idle';

          // Find conversation for this agent
          const conv = Object.values(conversations).find((c) => c.agentId === agent.id);
          let lastPreview = 'No conversation yet';
          let lastPreviewMuted = true;
          let lastTimestamp: number | null = null;

          if (conv && conv.messages.length > 0) {
            for (let i = conv.messages.length - 1; i >= 0; i--) {
              const msg = conv.messages[i]!;
              if (msg.role === 'assistant') {
                lastPreview = truncate(msg.content, 50);
                lastPreviewMuted = false;
                break;
              }
            }
            lastTimestamp = conv.updatedAt;
          }

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => navigateToAgent(agent.id)}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                padding: 0,
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = agent.color + '80';
                e.currentTarget.style.background = 'var(--bg-card-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              {/* Left color accent bar */}
              <div style={{
                width: 3,
                flexShrink: 0,
                backgroundColor: agent.color,
                borderRadius: '6px 0 0 6px',
              }} />

              {/* Card content */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '8px 10px',
                minWidth: 0,
              }}>
                {/* Top row: name + status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: agent.color,
                      whiteSpace: 'nowrap',
                    }}>
                      {agent.name}
                    </span>
                    <span style={{
                      fontSize: 8,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {agent.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {lastTimestamp && (
                      <span style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'var(--font-pixel)' }}>
                        {relativeTime(lastTimestamp)}
                      </span>
                    )}
                    <span style={statusDotStyle(status, agent.color)} />
                  </div>
                </div>

                {/* Bottom row: last message preview */}
                <p style={{
                  fontSize: 9,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontStyle: lastPreviewMuted ? 'italic' : 'normal',
                  margin: 0,
                }}>
                  {lastPreview}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Keyboard shortcut hint */}
      <p style={{
        fontSize: 7,
        color: 'var(--text-secondary)',
        textAlign: 'center',
        marginTop: 'auto',
        fontFamily: 'var(--font-pixel)',
        letterSpacing: 1,
      }}>
        PRESS 1-5 TO NAVIGATE
      </p>
    </div>
  );
}
