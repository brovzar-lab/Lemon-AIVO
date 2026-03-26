import { useOfficeStore } from '@/store/officeStore';
import { useDealStore } from '@/store/dealStore';
import { useFileStore } from '@/store/fileStore';
import { useMemoryStore } from '@/store/memoryStore';
import { useAudioStore } from '@/store/audioStore';
import { getAgent } from '@/config/agents';
import { getAudioManager } from '@/engine/audioManager';
import type { AgentId, AgentStatus } from '@/types/agent';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];

function isAgentId(id: string | null): id is AgentId {
  return id !== null && AGENT_IDS.includes(id as AgentId);
}

interface HeaderProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
  const activeRoomId = useOfficeStore((s) => s.activeRoomId);
  const agentStatuses = useOfficeStore((s) => s.agentStatuses);
  const activeDealId = useDealStore((s) => s.activeDealId);
  const deals = useDealStore((s) => s.deals);
  const activeDeal = deals.find((d) => d.id === activeDealId);
  const activeDealName = activeDeal?.name ?? null;
  const files = useFileStore((s) => s.files);
  const fileCount = isAgentId(activeRoomId)
    ? files.filter((f) => f.agentId === activeRoomId && (!activeDealId || f.dealId === activeDealId)).length
    : 0;
  const ambientMuted = useAudioStore((s) => s.ambientMuted);
  const sfxMuted = useAudioStore((s) => s.sfxMuted);
  const toggleAmbient = useAudioStore((s) => s.toggleAmbient);
  const toggleSfx = useAudioStore((s) => s.toggleSfx);
  const memoryFacts = useMemoryStore((s) => s.facts);
  const factCount = activeDealId
    ? memoryFacts.filter((f) => f.dealId === activeDealId).length
    : 0;

  let label: string;
  let sublabel: string | null = null;
  let dotColor = 'var(--status-working)';
  let dotAnimate = false;

  if (isAgentId(activeRoomId)) {
    const agent = getAgent(activeRoomId);
    if (agent) {
      label = agent.name;
      sublabel = agent.title;
      const status: AgentStatus = agentStatuses[activeRoomId] ?? 'idle';
      switch (status) {
        case 'thinking': dotColor = agent.color; dotAnimate = true; break;
        case 'needs-attention': dotColor = 'var(--accent-coral)'; break;
        default: dotColor = 'var(--status-working)'; break;
      }
    } else { label = 'Command Center'; }
  } else if (activeRoomId === 'war-room') {
    label = 'War Room'; dotColor = 'var(--accent-gold)';
  } else { label = 'Command Center'; }

  const iconBtn: React.CSSProperties = {
    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderRadius: 3,
    cursor: 'pointer', transition: 'color 0.15s',
  };

  return (
    <header data-testid="header" className="top-bar">
      {/* Left: app name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} style={iconBtn} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
            <span style={{
              display: 'block', width: 14, height: 10, border: '1px solid currentColor',
              borderRadius: 2, position: 'relative',
            }}>
              <span style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                background: 'currentColor', borderRadius: '1px 0 0 1px',
              }} />
            </span>
          </button>
        )}
        <span className="top-bar-title">LEMON STUDIOS</span>
        {activeDealName && (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>/</span>
            <span style={{
              fontSize: 8, color: 'var(--text-secondary)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140,
            }}>
              {activeDealName}
            </span>
          </>
        )}
      </div>

      {/* Right: audio + agent indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => {
            const newMuted = !ambientMuted;
            toggleAmbient();
            const audio = getAudioManager();
            audio.ensureContext();
            if (newMuted) { audio.setAmbientMuted(true); }
            else { void audio.playAmbient(activeRoomId); }
          }}
          style={iconBtn}
          title={ambientMuted ? 'Unmute ambient' : 'Mute ambient'}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {ambientMuted ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </svg>
        </button>

        <button onClick={() => toggleSfx()} style={iconBtn} title={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            {sfxMuted && <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />}
          </svg>
        </button>

        {/* Status dot */}
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          backgroundColor: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          animation: dotAnimate ? 'livePulse 1.5s ease-in-out infinite' : undefined,
        }} />

        <span style={{ fontSize: 9, color: 'var(--text-primary)' }}>
          {label}
          {sublabel && <span style={{ color: 'var(--text-secondary)' }}> - {sublabel}</span>}
        </span>

        {fileCount > 0 && (
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--accent-teal-light)',
            backgroundColor: 'rgba(77, 122, 107, 0.2)', padding: '2px 6px', borderRadius: 8, letterSpacing: 1,
          }}>
            {fileCount} FILE{fileCount !== 1 ? 'S' : ''}
          </span>
        )}
        {factCount > 0 && (
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--accent-gold)',
            backgroundColor: 'rgba(192, 160, 96, 0.15)', padding: '2px 6px', borderRadius: 8, letterSpacing: 1,
          }}>
            {factCount} FACT{factCount !== 1 ? 'S' : ''}
          </span>
        )}

        {/* Online dot */}
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          backgroundColor: 'var(--status-working)', boxShadow: '0 0 6px var(--status-working)',
        }} />
        <span style={{ fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)', letterSpacing: 1 }}>
          ONLINE
        </span>
      </div>
    </header>
  );
}
