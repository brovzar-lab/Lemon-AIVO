import { useOfficeStore } from '@/store/officeStore';
import { getAgent } from '@/config/agents';
import type { AgentId, AgentStatus } from '@/types/agent';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

/**
 * Horizontal agent bar — sits above the canvas in the center column.
 * Each chip shows avatar initial, name, role, and a glowing status dot.
 * Clicking a chip selects that agent's room on the canvas.
 */
export function AgentBar() {
  const activeRoomId = useOfficeStore((s) => s.activeRoomId);
  const setActiveRoom = useOfficeStore((s) => s.setActiveRoom);
  const agentStatuses = useOfficeStore((s) => s.agentStatuses);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '6px 12px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {AGENT_IDS.map((id) => {
        const agent = getAgent(id);
        if (!agent) return null;
        const isActive = activeRoomId === id;
        const status = (agentStatuses[id] as AgentStatus | undefined) ?? 'idle';

        return (
          <button
            key={id}
            onClick={() => setActiveRoom(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '4px 10px 4px 5px',
              background: isActive ? 'var(--bg-card-hover)' : 'var(--bg-card)',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
              border: isActive ? '1px solid var(--accent-teal)' : '1px solid transparent',
              flex: 1,
              minWidth: 40,
              maxWidth: 160,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            title={`${agent.name} — ${agent.title}`}
          >
            {/* Avatar circle */}
            <span style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-pixel)',
              fontSize: 8,
              color: '#fff',
              background: agent.color,
              flexShrink: 0,
            }}>
              {agent.name[0]}
            </span>

            {/* Name + role */}
            <span style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              overflow: 'hidden',
              minWidth: 0,
            }}>
              <span style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--text-bright)',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {agent.name.toUpperCase()}
              </span>
              <span style={{
                fontSize: 7,
                color: 'var(--text-secondary)',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {agent.title}
              </span>
            </span>

            {/* Status dot */}
            <StatusDot status={status} />
          </button>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  const color =
    status === 'thinking' ? 'var(--status-meeting)' :
    status === 'needs-attention' ? 'var(--accent-coral)' :
    status === 'idle' ? 'var(--status-idle)' :
    status === 'working' ? 'var(--status-working)' :
    'var(--text-secondary)';

  return (
    <span style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      flexShrink: 0,
      marginLeft: 2,
      background: color,
      boxShadow: color !== 'var(--text-secondary)' ? `0 0 4px ${color}` : 'none',
    }} />
  );
}
