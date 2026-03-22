import { useEffect, useRef } from 'react';
import type { AgentId } from '@/types/agent';
import { useChatStore } from '@/store/chatStore';
import { useWarRoom } from '@/hooks/useWarRoom';
import { WarRoomMessage } from './WarRoomMessage';
import { ChatInput } from './ChatInput';

const AGENT_ORDER: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'charlie'];

/**
 * War Room chat panel — pixel-art styled.
 */
export function WarRoomPanel() {
  const { sendBroadcast, cancelAll, isGathering, warRoomRound } = useWarRoom();
  const warRoomStreaming = useChatStore((s) => s.warRoomStreaming);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAnyStreaming = AGENT_ORDER.some(
    (id) => warRoomStreaming[id]?.status === 'streaming' || warRoomStreaming[id]?.status === 'retrying',
  );

  const hasAnyContent = AGENT_ORDER.some(
    (id) => warRoomStreaming[id]?.currentContent || warRoomStreaming[id]?.status !== 'idle',
  );

  useEffect(() => {
    if (hasAnyContent) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hasAnyContent, warRoomStreaming]);

  const handleSend = (content: string) => {
    void sendBroadcast(content);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Response area */}
      <div className="chat-messages">
        {isGathering && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">⚔️</div>
            <h3>GATHERING AGENTS...</h3>
          </div>
        )}

        {!isGathering && !hasAnyContent && warRoomRound === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">⚔️</div>
            <h3>WAR ROOM</h3>
            <p>Ask the team a question — all 5 agents will respond simultaneously</p>
          </div>
        )}

        {hasAnyContent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {AGENT_ORDER.map((agentId) => (
              <WarRoomMessage key={agentId} agentId={agentId} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Cancel button */}
      {isAnyStreaming && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 6,
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-panel)',
        }}>
          <button
            type="button"
            onClick={cancelAll}
            className="chat-send"
            style={{
              width: 'auto',
              padding: '4px 16px',
              backgroundColor: 'var(--accent-coral)',
              fontSize: 7,
              fontFamily: 'var(--font-pixel)',
              letterSpacing: 1,
            }}
          >
            CANCEL ALL
          </button>
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        onCancel={cancelAll}
        isStreaming={isGathering || isAnyStreaming}
        placeholder={isGathering ? 'Waiting for agents...' : 'Ask the team...'}
      />
    </div>
  );
}
