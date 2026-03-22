import { useState } from 'react';
import { useDealStore } from '@/store/dealStore';
import { useChatStore } from '@/store/chatStore';
import type { AgentId } from '@/types/agent';
import { DealCard } from './DealCard';
import { CreateDealForm } from './CreateDealForm';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];

/**
 * Deals sidebar — pixel-art styled.
 */
export function DealSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const deals = useDealStore((s) => s.deals);
  const activeDealId = useDealStore((s) => s.activeDealId);
  const conversations = useChatStore((s) => s.conversations);
  const activeDeal = deals.find((d) => d.id === activeDealId);

  function getAgentActivity(dealId: string): Record<string, number> {
    const activity: Record<string, number> = {};
    for (const agentId of AGENT_IDS) {
      const count = Object.values(conversations).filter(
        (conv) => conv.dealId === dealId && conv.agentId === agentId && conv.messages.length > 0,
      ).length;
      activity[agentId] = count;
    }
    return activity;
  }

  const activeDeals = deals.filter(d => d.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt);
  const archivedDeals = deals.filter(d => d.status === 'archived').sort((a, b) => b.updatedAt - a.updatedAt);

  const handleSwitchDeal = async (dealId: string) => {
    await useDealStore.getState().switchDeal(dealId);
  };

  const handleDealCreated = async (dealId: string) => {
    setShowCreateForm(false);
    await useDealStore.getState().switchDeal(dealId);
  };

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        title="Expand deals sidebar"
        style={{
          height: '100%', width: 36, flexShrink: 0,
          background: 'var(--bg-panel)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          cursor: 'pointer', transition: 'width 0.2s',
        }}
      >
        <div style={{ paddingTop: 10, paddingBottom: 6, color: 'var(--text-secondary)' }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        {activeDeal && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-pixel)', fontWeight: 600,
              color: 'var(--accent-gold)', whiteSpace: 'nowrap', writingMode: 'vertical-rl', letterSpacing: 1,
            }}>
              {activeDeal.name}
            </span>
          </div>
        )}
      </div>
    );
  }

  const iconBtn: React.CSSProperties = {
    width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderRadius: 3,
    cursor: 'pointer', transition: 'color 0.15s',
  };

  return (
    <div style={{
      height: '100%', width: 200, flexShrink: 0,
      background: 'var(--bg-panel)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'width 0.2s',
    }}>
      {/* Active deal header */}
      {activeDeal && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
              }}>
                ACTIVE DEAL
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text-bright)',
                borderLeft: '2px solid var(--accent-gold)', paddingLeft: 6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {activeDeal.name}
              </div>
            </div>
            <button onClick={() => setCollapsed(true)} style={iconBtn} aria-label="Collapse sidebar">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Deals header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span className="section-title" style={{ color: 'var(--accent-gold)', margin: 0 }}>DEALS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            style={{ ...iconBtn, color: 'var(--accent-gold)', fontSize: 12, fontWeight: 700 }}
            aria-label="Create deal" title="New deal"
          >
            +
          </button>
          {!activeDeal && (
            <button onClick={() => setCollapsed(true)} style={iconBtn} aria-label="Collapse sidebar">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showCreateForm && (
        <CreateDealForm
          onCreated={(dealId) => void handleDealCreated(dealId)}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Deal list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, scrollbarWidth: 'thin' as const }}>
        {activeDeals.map((deal) => (
          <DealCard
            key={deal.id} deal={deal} isActive={deal.id === activeDealId}
            agentActivity={getAgentActivity(deal.id)}
            onSelect={() => void handleSwitchDeal(deal.id)}
          />
        ))}
        {showArchived && archivedDeals.map((deal) => (
          <DealCard
            key={deal.id} deal={deal} isActive={deal.id === activeDealId}
            agentActivity={getAgentActivity(deal.id)}
            onSelect={() => void handleSwitchDeal(deal.id)}
          />
        ))}
      </div>

      {archivedDeals.length > 0 && (
        <div style={{ padding: '4px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{
              fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)',
              background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: 1,
            }}
          >
            {showArchived ? 'HIDE ARCHIVED' : `ARCHIVED (${archivedDeals.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
