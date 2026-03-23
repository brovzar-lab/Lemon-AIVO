import { useState } from 'react';
import { getAgent } from '@/config/agents';
import { CollabSummaryView } from '@/components/collaboration/CollabSummaryView';
import type { ChainSnapshot, CollabChain } from '@/types/collaboration';

function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0 && now.getDate() === date.getDate()) return 'TODAY';
  if (diffDays <= 1 && now.getDate() - date.getDate() === 1) return 'YESTERDAY';
  if (diffDays < 7) return 'THIS WEEK';
  return 'OLDER';
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface Props {
  chains: ChainSnapshot[];
  activeChain?: CollabChain | ChainSnapshot;
  onStartNew: () => void;
}

export function CollabHistoryList({ chains, activeChain, onStartNew }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayChains: ChainSnapshot[] = [];
  if (activeChain) displayChains.push(activeChain);
  for (const c of chains) {
    if (activeChain && c.id === activeChain.id) continue;
    displayChains.push(c);
  }

  const groups = new Map<string, ChainSnapshot[]>();
  for (const chain of displayChains) {
    const group = getDateGroup(chain.startedAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(chain);
  }

  const isEmpty = displayChains.length === 0;

  return (
    <div data-testid="collab-history-list" style={{
      flex: 1,
      overflowY: 'auto',
      padding: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      scrollbarWidth: 'thin' as const,
    }}>
      <div className="section-title" style={{ color: 'var(--accent-gold)' }}>
        COLLAB HISTORY
      </div>

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
          transition: 'background 0.15s',
        }}
      >
        + NEW COLLAB
      </button>

      {isEmpty && (
        <div style={{ fontSize: 9, color: 'var(--text-secondary)', textAlign: 'center', padding: 16 }}>
          No collaborations yet.
        </div>
      )}

      {Array.from(groups.entries()).map(([groupLabel, groupChains]) => (
        <div key={groupLabel}>
          <div style={{
            fontSize: 7,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-pixel)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 4,
            marginTop: 2,
          }}>
            {groupLabel}
          </div>

          {groupChains.map((chain) => {
            const isExpanded = expandedId === chain.id;
            const originAgent = getAgent(chain.originAgentId);
            const targetAgentIds = [...new Set(chain.hops.map(h => h.toAgentId))];
            const targetNames = targetAgentIds
              .map(id => getAgent(id))
              .filter(Boolean)
              .map(a => a!.name);
            const statusColor = chain.status === 'completed' ? 'var(--status-working)' : 'var(--accent-coral)';
            const statusLabel = chain.status === 'completed' ? 'DONE' : 'STOPPED';

            return (
              <div key={chain.id} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : chain.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    transition: 'border-color 0.15s, background 0.15s',
                    borderLeft: chain.status === 'completed' ? '3px solid var(--status-working)' : '3px solid var(--accent-coral)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9 }}>
                      <span style={{ color: originAgent?.color ?? 'var(--text-secondary)', fontWeight: 700 }}>
                        {originAgent?.name ?? chain.originAgentId}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}> → </span>
                      {targetNames.length > 0 ? (
                        targetNames.map((name, i) => {
                          const agent = getAgent(targetAgentIds[i]!);
                          return (
                            <span key={targetAgentIds[i]}>
                              {i > 0 && <span style={{ color: 'var(--text-secondary)' }}>, </span>}
                              <span style={{ color: agent?.color ?? 'var(--text-secondary)', fontWeight: 700 }}>
                                {name}
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 7,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-pixel)',
                      flexShrink: 0,
                      marginLeft: 6,
                    }}>
                      {formatRelativeTime(chain.startedAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {chain.initialTask.slice(0, 50)}
                    {chain.initialTask.length > 50 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      display: 'inline-block',
                      flexShrink: 0,
                      boxShadow: `0 0 4px ${statusColor}`,
                    }} />
                    <span style={{
                      fontSize: 7,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: statusColor,
                      fontFamily: 'var(--font-pixel)',
                    }}>
                      {statusLabel}
                    </span>
                    {chain.tokenBudgetUsed > 0 && (
                      <span style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'var(--font-pixel)' }}>
                        · {chain.tokenBudgetUsed.toLocaleString()} tk
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div style={{
                    borderLeft: '2px solid var(--border)',
                    marginLeft: 10,
                    marginTop: 4,
                  }}>
                    <CollabSummaryView chain={chain} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
