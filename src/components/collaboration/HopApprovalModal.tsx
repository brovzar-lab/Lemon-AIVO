import { useState } from 'react';
import { useCollaborationStore } from '@/store/collaborationStore';
import { getAgent } from '@/config/agents';

export function HopApprovalModal() {
  const pendingHop = useCollaborationStore((s) => s.pendingHop);
  const approveHop = useCollaborationStore((s) => s.approveHop);
  const skipHop = useCollaborationStore((s) => s.skipHop);
  const abortChain = useCollaborationStore((s) => s.abortChain);
  const [instruction, setInstruction] = useState('');

  if (!pendingHop) return null;

  const { hop, chainId, lastHopSummary } = pendingHop;
  const targetAgent = getAgent(hop.toAgentId);
  const agentColor = targetAgent?.color ?? 'var(--text-secondary)';

  function handleApprove() {
    approveHop(chainId, hop.hopIndex, instruction.trim() || undefined);
    setInstruction('');
  }

  function handleSkip() {
    skipHop(chainId, hop.hopIndex);
    setInstruction('');
  }

  function handleStop() {
    abortChain('User stopped chain');
    setInstruction('');
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--accent-gold)',
        borderRadius: 8,
        padding: 20,
        width: 360,
        maxWidth: '90vw',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        {/* Title */}
        <div>
          <div style={{
            fontSize: 7,
            color: 'var(--accent-gold)',
            fontFamily: 'var(--font-pixel)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}>
            CONSULTATION REQUEST
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: agentColor,
            fontFamily: 'var(--font-pixel)',
          }}>
            {targetAgent?.name ?? hop.toAgentId}
          </div>
          {targetAgent?.title && (
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>
              {targetAgent.title}
            </div>
          )}
        </div>

        {/* Reason */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 6,
          padding: '8px 10px',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: 7,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-pixel)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 4,
          }}>
            WHY NEEDED
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {hop.reason}
          </div>
        </div>

        {/* Last hop summary */}
        {lastHopSummary && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 6,
            padding: '8px 10px',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: 7,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-pixel)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 4,
            }}>
              PREVIOUS RESULT
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {lastHopSummary}...
            </div>
          </div>
        )}

        {/* Optional instructions */}
        <div>
          <label style={{
            fontSize: 7,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-pixel)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            display: 'block',
            marginBottom: 4,
          }}>
            ADD INSTRUCTIONS <span style={{ fontWeight: 400, textTransform: 'none', fontFamily: 'var(--font-ui)' }}>(optional)</span>
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={`e.g. "Focus on compliance"`}
            rows={2}
            className="chat-input"
            style={{
              width: '100%',
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleApprove}
            style={{
              flex: 2,
              padding: '7px 0',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid var(--status-working)',
              borderRadius: 4,
              color: 'var(--status-working)',
              cursor: 'pointer',
              fontSize: 8,
              fontFamily: 'var(--font-pixel)',
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            APPROVE
          </button>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '7px 0',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 8,
              fontFamily: 'var(--font-pixel)',
              letterSpacing: 1,
            }}
          >
            SKIP
          </button>
          <button
            onClick={handleStop}
            style={{
              flex: 1,
              padding: '7px 0',
              backgroundColor: 'rgba(192, 96, 80, 0.1)',
              border: '1px solid var(--accent-coral)',
              borderRadius: 4,
              color: 'var(--accent-coral)',
              cursor: 'pointer',
              fontSize: 8,
              fontFamily: 'var(--font-pixel)',
              letterSpacing: 1,
            }}
          >
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}
