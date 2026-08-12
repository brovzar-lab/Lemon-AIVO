import { useState, useEffect } from 'react';
import { useOfficeStore } from '@/store/officeStore';
import { useDealStore } from '@/store/dealStore';
import { useActivityStore } from '@/store/activityStore';
import type { AgentId, AgentStatus } from '@/types/agent';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

interface LeftPanelProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

/**
 * Left panel — Office Dashboard.
 * Matches TEST PIXEL TEAM left column:
 * - Title header
 * - Active Deals list
 * - Activity Log (persistent, event-driven)
 * - Office Stats (Working/Idle/Meeting)
 *
 * Supports collapsed mode: shows a slim icon strip instead of the full panel.
 */
export function LeftPanel({ collapsed = false, onToggle }: LeftPanelProps) {
  const agentStatuses = useOfficeStore((s) => s.agentStatuses);
  const activeDealId = useDealStore((s) => s.activeDealId);
  const deals = useDealStore((s) => s.deals);
  const activities = useActivityStore((s) => s.entries);

  const [clock, setClock] = useState('');

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Compute stats from real agent status values.
  // 'thinking' = AI is streaming a reply (Meeting).
  // 'needs-attention' = agent pinged user (Idle).
  // 'idle' = default resting state (Idle).
  const stats = { working: 0, idle: 0, meeting: 0 };
  AGENT_IDS.forEach((id) => {
    const s = agentStatuses[id] as AgentStatus | undefined;
    if (s === 'thinking') stats.meeting++;
    else if (s === 'needs-attention') stats.idle++;
    else stats.idle++; // 'idle' (default) → Idle
  });

  if (collapsed) {
    return (
      <aside data-testid="left-panel" className="panel panel-left">
        <div className="panel-collapsed-strip">
          <div className="collapsed-icon" onClick={onToggle} title="Expand dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>
          </div>
          <div className="collapsed-icon" onClick={onToggle} title="Activity log">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          <div className="collapsed-icon" onClick={onToggle} title="Office stats">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside data-testid="left-panel" className="panel panel-left">
      {/* Collapse toggle */}
      {onToggle && (
        <button className="panel-collapse-btn" onClick={onToggle} aria-label="Collapse left panel" title="Collapse">
          ‹
        </button>
      )}

      {/* Header */}
      <div style={{
        padding: '14px 12px 8px',
        borderBottom: '1px solid var(--border)',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 'var(--pixel-md)',
          color: 'var(--accent-teal-light)',
          letterSpacing: 2,
          marginBottom: 2,
        }}>
          LEMON STUDIOS
        </div>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Office Dashboard
        </div>
      </div>

      {/* Active Deals Section */}
      <div className="panel-section" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="section-title" style={{ color: 'var(--accent-coral)', fontSize: 'var(--pixel-xs)', letterSpacing: 1.5, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
            </svg>
            ACTIVE DEALS
          </div>
          <span style={{
            fontSize: 'var(--pixel-xs)', color: 'var(--accent-coral-dim, var(--accent-coral))', fontWeight: 600,
            padding: '2px 6px', background: 'var(--bg-card)', borderRadius: 8,
          }}>
            {deals.filter((d) => d.status === 'active').length} open
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
          {deals.filter((d) => d.status === 'active').map((deal) => (
            <DealCard key={deal.id} deal={deal} isActive={deal.id === activeDealId} />
          ))}
          {deals.filter((d) => d.status === 'active').length === 0 && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: 12, textAlign: 'center' }}>
              No active deals
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="panel-section" style={{ flexShrink: 0, maxHeight: 180, overflow: 'hidden' }}>
        <div className="section-title" style={{ margin: 0, marginBottom: 6 }}>ACTIVITY LOG</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', maxHeight: 140, scrollbarWidth: 'thin' }}>
          {activities.map((act) => (
            <li key={act.id} className="activity-item">
              <span className="activity-time">{act.time}</span>
              <span className="activity-text">
                <strong style={{ color: 'var(--text-bright)' }}>{act.agentName}</strong> {act.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Office Stats */}
      <div className="panel-section" style={{ flexShrink: 0 }}>
        <div className="section-title" style={{ margin: 0, marginBottom: 6 }}>OFFICE STATS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <StatCard label="Working" value={stats.working} color="var(--status-working)" />
          <StatCard label="Idle" value={stats.idle} color="var(--status-idle)" />
          <StatCard label="Meeting" value={stats.meeting} color="var(--status-meeting)" />
        </div>
      </div>

      {/* Footer clock */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 'var(--pixel-xs)',
          color: 'var(--text-secondary)',
          letterSpacing: 1,
        }}>
          {clock}
        </span>
      </div>
    </aside>
  );
}

// ── Deal Card ──────────────────────────────────────────────────────────────
function DealCard({ deal, isActive }: { deal: { id: string; name: string; description?: string; status: string }; isActive: boolean }) {
  const switchDeal = useDealStore((s) => s.switchDeal);

  return (
    <div
      onClick={() => void switchDeal(deal.id)}
      style={{
        padding: '8px 10px',
        marginBottom: 4,
        background: isActive ? 'var(--bg-card-hover, var(--bg-card))' : 'var(--bg-card)',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        borderLeft: isActive ? '3px solid var(--accent-teal)' : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isActive ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-coral)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 2c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z" />
            <path d="M12 12c0 3-2 4-2 6a2 2 0 004 0c0-2-2-3-2-6z" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        <span style={{
          fontSize: 10, fontWeight: 600, color: 'var(--text-bright)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {deal.name}
        </span>
      </div>
      {deal.description && (
        <div style={{
          fontSize: 8, color: 'var(--text-secondary)', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {deal.description}
        </div>
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 6,
      padding: '8px 6px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 14,
        color: 'var(--text-bright)',
        marginBottom: 2,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{
        height: 3,
        borderRadius: 2,
        marginTop: 6,
        background: 'var(--bg-input, rgba(0,0,0,0.3))',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, (value / AGENT_IDS.length) * 100)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}
