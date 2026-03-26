import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface StreamingIndicatorProps {
  content: string;
  agentName?: string;
}

/**
 * Streaming content display — pixel-art styled.
 */
export function StreamingIndicator({ content, agentName = 'Agent' }: StreamingIndicatorProps) {
  return (
    <div data-testid="streaming-indicator" className="chat-msg agent">
      <div className="msg-header">
        <span className="msg-author" style={{ color: 'var(--accent-gold)' }}>{agentName}</span>
      </div>
      <div className="msg-bubble" style={{
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderBottomLeftRadius: 3,
      }}>
        <div>
          {content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
          ) : null}
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 12,
            backgroundColor: 'var(--accent-teal)',
            borderRadius: 2,
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'livePulse 1.5s ease-in-out infinite',
          }}
            aria-label="Streaming..."
          />
        </div>
      </div>
    </div>
  );
}
