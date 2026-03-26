import { useEffect, useRef } from 'react';
import type { Message } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  agentName?: string;
}

/**
 * Scrollable message container — pixel-art styled.
 */
export function MessageList({ messages, isStreaming, streamingContent, agentName = 'your agent' }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div data-testid="message-list" className="chat-welcome">
        <div className="chat-welcome-icon">💬</div>
        <h3>START A CONVERSATION</h3>
        <p>Send a message to {agentName}</p>
      </div>
    );
  }

  return (
    <div data-testid="message-list" className="chat-messages">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} agentName={agentName} />
      ))}
      {isStreaming && <StreamingIndicator content={streamingContent} agentName={agentName} />}
      <div ref={bottomRef} />
    </div>
  );
}
