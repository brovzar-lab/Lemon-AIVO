import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  placeholder?: string;
  onAttachClick?: () => void;
  fileCount?: number;
  onMemoryClick?: () => void;
  factCount?: number;
  isProcessing?: boolean;
}

/**
 * Chat input area — pixel-art styled.
 * Uses .chat-input-area, .chat-input, .chat-send CSS classes.
 */
export function ChatInput({
  onSend,
  onCancel,
  isStreaming,
  placeholder = 'Type a message...',
  onAttachClick,
  fileCount = 0,
  onMemoryClick,
  factCount = 0,
  isProcessing = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming) handleSend();
      }
    },
    [handleSend, isStreaming],
  );

  return (
    <div className="chat-input-area" style={{ flexDirection: 'column', gap: 4 }}>
      {/* Processing indicator */}
      {isProcessing && (
        <div style={{
          fontSize: 7,
          color: 'var(--accent-gold)',
          fontFamily: 'var(--font-pixel)',
          letterSpacing: 1,
          padding: '0 2px 2px',
          animation: 'livePulse 1.5s ease-in-out infinite',
        }}>
          PROCESSING FILE...
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {/* Left icon buttons: Attach + Memory */}
        {(onAttachClick || onMemoryClick) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingBottom: 2 }}>
            {onAttachClick && (
              <button
                type="button"
                onClick={onAttachClick}
                title="Attach PDF, DOCX or Excel file"
                aria-label="Attach file"
                style={{
                  position: 'relative',
                  padding: 5,
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {fileCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    backgroundColor: 'var(--accent-teal)',
                    color: 'var(--text-bright)',
                    fontSize: 7,
                    borderRadius: '50%',
                    width: 12,
                    height: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}>
                    {fileCount > 9 ? '9+' : fileCount}
                  </span>
                )}
              </button>
            )}
            {onMemoryClick && (
              <button
                type="button"
                onClick={onMemoryClick}
                title="Memory facts"
                aria-label="View memory facts"
                style={{
                  position: 'relative',
                  padding: 5,
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {factCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    backgroundColor: 'var(--accent-gold-dim)',
                    color: 'var(--text-bright)',
                    fontSize: 7,
                    borderRadius: '50%',
                    width: 12,
                    height: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}>
                    {factCount > 9 ? '9+' : factCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isStreaming}
          className="chat-input"
          style={{
            flex: 1,
            resize: 'none',
            ...(isStreaming ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          }}
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            className="chat-send"
            aria-label="Cancel response"
            style={{ backgroundColor: 'var(--accent-coral)' }}
          >
            ■
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim()}
            className="chat-send"
            aria-label="Send message"
            style={!value.trim() ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >
            ▶
          </button>
        )}
      </div>
    </div>
  );
}
