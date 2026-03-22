import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '@/types/chat';
import { WarRoomBadge } from './WarRoomBadge';
import { parseDealAction, stripDealAction } from '@/services/actions/parseDealAction';

interface MessageBubbleProps {
  message: Message;
  agentName?: string;
}

/**
 * Individual message display — pixel-art styled.
 * Uses .chat-msg, .msg-bubble CSS classes from pixelDesignSystem.css.
 */
export const MessageBubble = memo(function MessageBubble({ message, agentName = 'Agent' }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSummary = message.isSummary === true;

  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isSummary) {
    return (
      <div className="chat-msg agent">
        <div className="msg-header">
          <span className="msg-author" style={{ color: 'var(--text-secondary)' }}>CONTEXT SUMMARY</span>
        </div>
        <div className="msg-bubble" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
        }}>
          <MarkdownContent content={message.content} />
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="chat-msg user">
        {message.source === 'war-room' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
            <WarRoomBadge />
          </div>
        )}
        <div className="msg-header" style={{ justifyContent: 'flex-end' }}>
          <span className="msg-time">{timestamp}</span>
          <span className="msg-author" style={{ color: 'var(--accent-teal-light)' }}>YOU</span>
        </div>
        <div className="msg-bubble" style={{
          background: 'var(--accent-teal)',
          color: 'var(--text-bright)',
          borderBottomRightRadius: 3,
        }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
        </div>
      </div>
    );
  }

  const isWarRoom = message.source === 'war-room';
  const dealAction = !isUser && !isSummary ? parseDealAction(message.content) : null;
  const visibleContent = dealAction ? stripDealAction(message.content) : message.content;

  return (
    <div className="chat-msg agent">
      <div className="msg-header">
        <span className="msg-author" style={{ color: 'var(--accent-gold)' }}>{agentName}</span>
        {isWarRoom && <WarRoomBadge />}
        <span className="msg-time">{timestamp}</span>
      </div>
      <div className="msg-bubble" style={{
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderBottomLeftRadius: 3,
      }}>
        <MarkdownContent content={visibleContent} />
      </div>

      {/* Deal Created confirmation card */}
      {dealAction && (
        <div style={{
          marginTop: 6,
          borderRadius: 6,
          border: '1px solid rgba(192, 160, 96, 0.4)',
          background: 'rgba(192, 160, 96, 0.1)',
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>📁</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-pixel)', marginBottom: 2 }}>
              DEAL CREATED
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dealAction.name}
            </div>
            {dealAction.description && (
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                {dealAction.description}
              </div>
            )}
            <div style={{ fontSize: 7, color: 'var(--accent-gold)', marginTop: 4, fontFamily: 'var(--font-pixel)' }}>
              NOW ACTIVE · FILES MOVED
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function MarkdownContent({ content }: { content: string }) {
  return (
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
        table({ children, ...props }) {
          return (
            <div style={{ overflowX: 'auto', margin: '4px 0' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10, width: '100%' }} {...props}>{children}</table>
            </div>
          );
        },
        th({ children, ...props }) {
          return (
            <th style={{
              border: '1px solid var(--border)',
              padding: '4px 8px',
              textAlign: 'left',
              color: 'var(--accent-gold)',
              fontWeight: 600,
            }} {...props}>
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td style={{
              border: '1px solid var(--border)',
              padding: '4px 8px',
            }} {...props}>
              {children}
            </td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
