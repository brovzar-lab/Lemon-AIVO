import { useState, useEffect } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useCollaborationStore } from '@/store/collaborationStore';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';
import { CollabHistoryList } from '@/components/collaboration/CollabHistoryList';
import { HopApprovalModal } from '@/components/collaboration/HopApprovalModal';

/**
 * Right panel — Chat + Teamwork.
 * Matches TEST PIXEL TEAM's right column: chat on top, teamwork on bottom.
 * Width: 270px, dark panel with left border.
 */
export function RightPanel() {
  const activeChain = useCollaborationStore((s) => s.activeChain);
  const pendingHop = useCollaborationStore((s) => s.pendingHop);
  const chainHistory = useCollaborationStore((s) => s.chainHistory);
  const hasCollabActivity = activeChain !== null || chainHistory.length > 0;

  const [showTeamwork, setShowTeamwork] = useState(false);

  // Auto-show teamwork section when there's activity
  useEffect(() => {
    if (hasCollabActivity) setShowTeamwork(true);
  }, [hasCollabActivity]);

  return (
    <>
      <aside style={{
        width: 'var(--panel-width)',
        minWidth: 'var(--panel-width)',
        height: '100%',
        background: 'var(--bg-panel)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid var(--border)',
      }}>
        {/* ─── Top: Chat ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Chat header */}
          <div style={{
            padding: '14px 12px 8px',
            borderBottom: '1px solid var(--border)',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 11,
              color: 'var(--accent-teal-light)',
              letterSpacing: 2,
              marginBottom: 2,
            }}>
              TEAM CHAT
            </div>
            <div style={{
              fontSize: 9,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Talk to your agents
            </div>
          </div>

          {/* Approval banner */}
          {pendingHop && (
            <div style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 4,
              padding: '6px 10px',
              margin: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, color: 'var(--accent-gold)', fontFamily: 'var(--font-pixel)' }}>
                HOP PENDING
              </span>
              <button
                onClick={() => setShowTeamwork(true)}
                style={{
                  fontSize: 9,
                  color: 'var(--accent-gold)',
                  background: 'transparent',
                  border: '1px solid var(--accent-gold)',
                  borderRadius: 3,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-pixel)',
                }}
              >
                REVIEW
              </button>
            </div>
          )}

          {/* Chat panel */}
          <ChatPanel />
        </div>

        {/* ─── Bottom: Teamwork ─── */}
        {hasCollabActivity && (
          <div style={{
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            maxHeight: showTeamwork ? 280 : 36,
            overflow: 'hidden',
            transition: 'max-height 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Teamwork header (always visible, toggleable) */}
            <button
              onClick={() => setShowTeamwork(!showTeamwork)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 8,
                color: 'var(--accent-gold)',
                letterSpacing: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                TEAMWORK
              </span>
              <span style={{
                fontSize: 8,
                color: 'var(--accent-gold-dim, var(--text-secondary))',
                fontWeight: 600,
                padding: '2px 6px',
                background: 'var(--bg-card)',
                borderRadius: 8,
              }}>
                {activeChain?.status === 'running-hop' || activeChain?.status === 'walking' ? '● active' : `${chainHistory.length} done`}
              </span>
            </button>

            {/* Teamwork content */}
            {showTeamwork && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeChain &&
                activeChain.status !== 'completed' &&
                activeChain.status !== 'aborted' ? (
                  <CollaborationPanel onStartNew={() => {}} />
                ) : (
                  <CollabHistoryList
                    chains={chainHistory}
                    activeChain={
                      activeChain?.status === 'completed' || activeChain?.status === 'aborted'
                        ? activeChain
                        : undefined
                    }
                    onStartNew={() => {}}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* HopApprovalModal — rendered outside panel layout */}
      <HopApprovalModal />
    </>
  );
}
