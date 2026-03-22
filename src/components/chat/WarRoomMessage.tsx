import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { AgentId } from '@/types/agent';
import { getAgent } from '@/config/agents';
import { useChatStore } from '@/store/chatStore';

interface WarRoomMessageProps {
  agentId: AgentId;
}

/**
 * Renders one agent's streaming response in the WarRoom — pixel-art styled.
 */
export function WarRoomMessage({ agentId }: WarRoomMessageProps) {
  const stream = useChatStore((s) => s.warRoomStreaming[agentId]);
  const agent = getAgent(agentId);
  if (!agent) return null;

  const { status, currentContent, error } = stream;

  if (status === 'idle' && !currentContent) return null;

  return (
    <div style={{
      paddingLeft: 10,
      paddingTop: 8,
      paddingBottom: 8,
      marginBottom: 4,
      borderLeft: `3px solid ${agent.color}`,
      animation: 'fadeSlideIn 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: agent.color }}>
          {agent.name}
        </span>
        <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>
          {agent.title}
        </span>
        <StatusIndicator status={status} />
      </div>

      {status === 'error' && error && (
        <p style={{ fontSize: 9, color: 'var(--accent-coral)' }}>{error}</p>
      )}

      {status === 'retrying' && (
        <p style={{
          fontSize: 7,
          color: 'var(--accent-gold)',
          fontFamily: 'var(--font-pixel)',
          letterSpacing: 1,
          animation: 'livePulse 1.5s ease-in-out infinite',
        }}>
          RETRYING...
        </p>
      )}

      {currentContent && (
        <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre({ children, ...props }) {
                return (
                  <pre style={{
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-dark)',
                    padding: 8,
                    overflowX: 'auto',
                    fontSize: 10,
                    margin: '4px 0',
                  }} {...props}>
                    {children}
                  </pre>
                );
              },
              code({ children, className, ...props }) {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code style={{
                      borderRadius: 3,
                      backgroundColor: 'var(--bg-dark)',
                      padding: '1px 4px',
                      fontSize: 10,
                      color: 'var(--accent-teal-light)',
                    }} {...props}>
                      {children}
                    </code>
                  );
                }
                return <code className={className} {...props}>{children}</code>;
              },
            }}
          >
            {currentContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'streaming':
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 7, color: 'var(--status-working)', fontFamily: 'var(--font-pixel)' }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: 'var(--status-working)',
            animation: 'livePulse 1.5s ease-in-out infinite',
          }} />
          LIVE
        </span>
      );
    case 'complete':
      return (
        <span style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'var(--font-pixel)' }}>DONE</span>
      );
    case 'error':
      return (
        <span style={{ fontSize: 7, color: 'var(--accent-coral)', fontFamily: 'var(--font-pixel)' }}>ERROR</span>
      );
    case 'retrying':
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 7, color: 'var(--accent-gold)', fontFamily: 'var(--font-pixel)' }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: 'var(--accent-gold)',
            animation: 'livePulse 1.5s ease-in-out infinite',
          }} />
          RETRY
        </span>
      );
    default:
      return null;
  }
}
