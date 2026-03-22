import { useEffect, useState, useCallback, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { useOfficeStore } from '@/store/officeStore';
import { useDealStore } from '@/store/dealStore';
import { useFileStore } from '@/store/fileStore';
import { useMemoryStore } from '@/store/memoryStore';
import { getAgent } from '@/config/agents';
import { useCollaborationStore } from '@/store/collaborationStore';
import { useCollaboration } from '@/hooks/useCollaboration';
import { CHAIN_TEMPLATES } from '@/services/collaboration/chainTemplates';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TokenCounter } from './TokenCounter';
import { ErrorBanner } from './ErrorBanner';
import { OverviewPanel } from './OverviewPanel';
import { WarRoomPanel } from './WarRoomPanel';
import { MemoryPanel } from '@/components/memory/MemoryPanel';
import type { AgentId, AgentStatus } from '@/types/agent';

const AGENT_ROOM_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];
const VALID_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.xls']);

function isAgentRoom(id: string | null): id is AgentId {
  return id !== null && AGENT_ROOM_IDS.includes(id as AgentId);
}

const panelBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  background: 'var(--bg-panel)',
};

/**
 * Main chat container — pixel-art styled.
 * Reads activeRoomId to determine which agent to chat with.
 */
export function ChatPanel() {
  const activeRoomId = useOfficeStore((s) => s.activeRoomId);
  const activeDealId = useDealStore((s) => s.activeDealId);
  const isProcessing = useFileStore((s) => s.isProcessing);
  const agentStatuses = useOfficeStore((s) => s.agentStatuses);
  const factCount = useMemoryStore((s) =>
    isAgentRoom(activeRoomId) && activeDealId
      ? s.getFactsForAgent(activeRoomId, activeDealId).length
      : 0
  );

  const files = useFileStore((s) => s.files);
  const fileCount = isAgentRoom(activeRoomId) && activeDealId
    ? files.filter((f) => f.agentId === activeRoomId && (!activeDealId || f.dealId === activeDealId)).length
    : 0;

  const [isDragOver, setIsDragOver] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isAgentRoom(activeRoomId)) return;
      const files = e.target.files;
      if (!files) return;
      const fileStore = useFileStore.getState();
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (VALID_EXTENSIONS.has(ext)) {
          fileStore.addFile(file, activeRoomId);
        }
      }
      e.target.value = '';
    },
    [activeRoomId],
  );

  useEffect(() => { setShowMemory(false); }, [activeRoomId, activeDealId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isAgentRoom(activeRoomId)) return;
    const files = e.dataTransfer?.files;
    if (!files) return;
    const fileStore = useFileStore.getState();
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (VALID_EXTENSIONS.has(ext)) {
        fileStore.addFile(file, activeRoomId);
      }
    }
  }, [activeRoomId]);

  if (activeRoomId === 'war-room') {
    return (
      <div style={panelBase}>
        <WarRoomPanel />
      </div>
    );
  }

  if (isAgentRoom(activeRoomId)) {
    const agent = getAgent(activeRoomId);
    const agentStatus = agentStatuses[activeRoomId] as AgentStatus | undefined;
    const isThinking = agentStatus === 'thinking';

    return (
      <div
        style={{ ...panelBase, position: 'relative' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Agent identity header */}
        {agent && (
          <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {/* Thin color accent bar */}
            <div style={{
              height: 2,
              width: '100%',
              backgroundColor: agent.color,
              ...(isThinking ? { animation: 'livePulse 1.5s ease-in-out infinite' } : {}),
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: agent.color }}>
                  {agent.name}
                </span>
                <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>
                  {agent.title}
                </span>
              </div>
              {isThinking && (
                <div className="typing-indicator" style={{ border: 'none', background: 'transparent', padding: '0 4px' }}>
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              )}
            </div>
          </div>
        )}

        <AgentChatPanel
          key={`${activeRoomId}-${activeDealId}`}
          agentId={activeRoomId}
          onAttachClick={() => fileInputRef.current?.click()}
          fileCount={fileCount}
          onMemoryClick={() => setShowMemory(true)}
          factCount={factCount}
          isProcessing={isProcessing}
        />

        {showMemory && (
          <MemoryPanel agentId={activeRoomId} onClose={() => setShowMemory(false)} />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.xls"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* Drop zone overlay */}
        {isDragOver && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed var(--accent-gold)',
            background: 'rgba(192, 160, 96, 0.1)',
            pointerEvents: 'none',
          }}>
            <span style={{
              color: 'var(--accent-gold)',
              fontSize: 10,
              fontFamily: 'var(--font-pixel)',
              letterSpacing: 1,
            }}>
              DROP FILE HERE
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={panelBase}>
      <OverviewPanel />
    </div>
  );
}

interface AgentChatPanelProps {
  agentId: AgentId;
  onAttachClick?: () => void;
  fileCount?: number;
  onMemoryClick?: () => void;
  factCount?: number;
  isProcessing?: boolean;
}

function AgentChatPanel({
  agentId,
  onAttachClick,
  fileCount,
  onMemoryClick,
  factCount,
  isProcessing,
}: AgentChatPanelProps) {
  const agent = getAgent(agentId);
  const agentName = agent?.name ?? agentId;

  const {
    messages,
    isStreaming,
    error,
    tokenCount,
    streamingContent,
    sendMessage,
    cancelStream,
    retryLastMessage,
    clearError,
  } = useChat(agentId);

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const activeChain = useCollaborationStore((s) => s.activeChain);
  const isChainActive =
    activeChain !== null &&
    activeChain.status !== 'completed' &&
    activeChain.status !== 'aborted';
  const collaboration = useCollaboration();

  useEffect(() => {
    useOfficeStore.getState().setAgentStatus(agentId, 'idle');
  }, [agentId]);

  return (
    <>
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        agentName={agentName}
      />

      <TokenCounter tokenCount={tokenCount} isSummarizing={false} />

      {error && (
        <ErrorBanner error={error} onRetry={retryLastMessage} onDismiss={clearError} />
      )}

      <div style={{ position: 'relative' }}>
        {/* Template picker popover */}
        {showTemplatePicker && !isChainActive && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            marginBottom: 4,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
          }}>
            <div style={{
              fontSize: 7,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-pixel)',
              letterSpacing: 1,
              marginBottom: 8,
              padding: '0 4px',
            }}>
              CHAIN TEMPLATES
            </div>
            {CHAIN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setShowTemplatePicker(false);
                  const taskDescription = prompt(`Task description for "${template.name}":`);
                  if (taskDescription) {
                    void collaboration.startTemplate(template.id, taskDescription, agentId);
                  }
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 8px',
                  marginBottom: 4,
                  borderRadius: 4,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 2 }}>
                  {template.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 3 }}>
                  {template.description}
                </div>
                <div style={{ fontSize: 8, color: 'var(--accent-teal)', fontFamily: 'var(--font-pixel)' }}>
                  {template.sequence.join(' → ')}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Chain template button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0' }}>
          <button
            onClick={() => !isChainActive && setShowTemplatePicker((p) => !p)}
            disabled={isChainActive}
            title={isChainActive ? 'Chain running' : 'Start collaboration template'}
            style={{
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: isChainActive ? 'var(--text-secondary)' : 'var(--accent-teal)',
              cursor: isChainActive ? 'not-allowed' : 'pointer',
              fontSize: 14,
              transition: 'border-color 0.15s',
            }}
          >
            &#9939;
          </button>
        </div>

        <ChatInput
          onSend={sendMessage}
          onCancel={cancelStream}
          isStreaming={isStreaming}
          placeholder={`Ask ${agentName} something...`}
          onAttachClick={onAttachClick}
          fileCount={fileCount}
          onMemoryClick={onMemoryClick}
          factCount={factCount}
          isProcessing={isProcessing}
        />
      </div>
    </>
  );
}
