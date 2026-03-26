import { useState } from 'react';
import type { Deal } from '@/types/deal';
import { agents } from '@/config/agents';
import type { AgentId } from '@/types/agent';
import { DealActions } from './DealActions';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];
const AGENT_INITIALS: Record<AgentId, string> = {
  patrik: 'P', marcos: 'M', sandra: 'S', isaac: 'I', wendy: 'W', charlie: 'C',
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

interface DealCardProps {
  deal: Deal;
  isActive: boolean;
  agentActivity: Record<string, number>;
  onSelect: () => void;
}

export function DealCard({ deal, isActive, agentActivity, onSelect }: DealCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isMuted = deal.status === 'archived' || deal.status === 'deleted';
  const activeAgents = AGENT_IDS.filter((id) => (agentActivity[id] ?? 0) > 0);

  return (
    <div
      data-testid="deal-card"
      onClick={onSelect}
      style={{
        position: 'relative',
        padding: '6px 10px',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderLeft: isActive ? '3px solid var(--accent-gold)' : '3px solid transparent',
        background: isActive ? 'rgba(192, 160, 96, 0.06)' : 'transparent',
        opacity: isMuted ? 0.5 : 1,
      }}
    >
      {/* Three-dot menu */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowActions((v) => !v); }}
        aria-label="Deal actions"
        style={{
          position: 'absolute', top: 6, right: 6, padding: 3,
          color: 'var(--text-secondary)', background: 'transparent', border: 'none',
          cursor: 'pointer', fontSize: 9, letterSpacing: 2, opacity: 0.4,
        }}
      >
        ···
      </button>

      {/* Deal name */}
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        paddingRight: 18, fontStyle: isMuted ? 'italic' : undefined,
      }}>
        {deal.name}
      </div>

      {deal.description && (
        <div style={{
          fontSize: 8, color: 'var(--text-secondary)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
        }}>
          {deal.description}
        </div>
      )}

      {/* Agent activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {activeAgents.length > 0 ? (
            activeAgents.map((agentId) => {
              const agent = agents[agentId];
              return (
                <span key={agentId} style={{
                  fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-pixel)',
                  color: agent?.color ?? 'var(--text-secondary)',
                }} title={`${agent?.name ?? agentId}: ${agentActivity[agentId]} conversations`}>
                  {AGENT_INITIALS[agentId]}:{agentActivity[agentId]}
                </span>
              );
            })
          ) : (
            AGENT_IDS.map((agentId) => {
              const agent = agents[agentId];
              return (
                <span key={agentId} style={{
                  width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                  backgroundColor: agent?.color ?? 'var(--text-secondary)', opacity: 0.3,
                }} title={agent?.name ?? agentId} />
              );
            })
          )}
        </div>
        <span style={{ fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)', letterSpacing: 1 }}>
          {relativeTime(deal.updatedAt)}
        </span>
      </div>

      {showActions && (
        <DealActions
          dealId={deal.id}
          dealName={deal.name}
          dealStatus={deal.status}
          onClose={() => setShowActions(false)}
        />
      )}
    </div>
  );
}
