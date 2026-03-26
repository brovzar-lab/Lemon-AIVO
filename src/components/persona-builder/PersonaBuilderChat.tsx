// src/components/persona-builder/PersonaBuilderChat.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePersonaBuilderStore } from '@/store/personaBuilderStore';
import { getAgent } from '@/config/agents';
import {
  runInterviewTurn,
  runExtractionPass,
  runPreviewTurn,
  buildPreviewSystemPrompt,
  assemblePersonaPrompt,
  truncateFileText,
} from '@/services/personaBuilderService';
import type { PersonaMessage } from '@/types/personaBuilder';
import { extractPdfText } from '@/services/files/extractPdf';
import { extractDocxText } from '@/services/files/extractDocx';

interface Props {
  onBackToBuild: (lastUserMsg: string) => void;
}

export function PersonaBuilderChat({ onBackToBuild }: Props) {
  const {
    agentId, mode, interviewMessages, previewMessages,
    appendInterviewMessage, appendPreviewMessage, setFields,
  } = usePersonaBuilderStore();

  const agent = agentId ? getAgent(agentId) : null;
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = mode === 'interview' ? interviewMessages : previewMessages;
  const appendMessage = mode === 'interview' ? appendInterviewMessage : appendPreviewMessage;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Guard against React StrictMode double-invocation: set flag synchronously so the
  // second effect run sees it before the async sendToInterviewAI resolves.
  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    if (mode !== 'interview' || !agentId || isStreaming) return;
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    void sendToInterviewAI([]);
    return () => {
      // Reset on cleanup so navigating away and back re-triggers the greeting
      hasTriggeredRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function sendToInterviewAI(msgs: PersonaMessage[]) {
    if (!agentId) return;
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let fullResponse = '';

    await runInterviewTurn(
      agentId,
      msgs,
      {
        onToken: (t) => setStreamingContent(prev => prev + t),
        onComplete: (full) => { fullResponse = full; },
        onError: (e) => setError(e.message),
      },
      controller.signal,
    );

    if (fullResponse) {
      appendInterviewMessage({ role: 'assistant', content: fullResponse });
      setStreamingContent('');

      const agent = getAgent(agentId);
      const extracted = await runExtractionPass(
        [...msgs, { role: 'assistant', content: fullResponse }],
        agent?.personaPrompt ?? '',
      );
      if (extracted) setFields(extracted);
    }

    setIsStreaming(false);
    abortRef.current = null;
  }

  async function sendToPreviewAI(msgs: PersonaMessage[]) {
    if (!agentId) return;
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let fullResponse = '';

    const { fields } = usePersonaBuilderStore.getState();
    const personaPrompt = assemblePersonaPrompt(fields);
    const systemPrompt = buildPreviewSystemPrompt(personaPrompt);

    await runPreviewTurn(
      systemPrompt,
      msgs,
      {
        onToken: (t) => setStreamingContent(prev => prev + t),
        onComplete: (full) => { fullResponse = full; },
        onError: (e) => setError(e.message),
      },
      controller.signal,
    );

    if (fullResponse) {
      appendPreviewMessage({ role: 'assistant', content: fullResponse });
      setStreamingContent('');
    }

    setIsStreaming(false);
    abortRef.current = null;
  }

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;
    const userMsg: PersonaMessage = { role: 'user', content: inputValue.trim() };
    appendMessage(userMsg);
    setInputValue('');

    const updatedMsgs = [...messages, userMsg];
    if (mode === 'interview') {
      await sendToInterviewAI(updatedMsgs);
    } else {
      await sendToPreviewAI(updatedMsgs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isStreaming, messages, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agentId) return;
    e.target.value = '';

    let text = '';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    try {
      if (ext === 'pdf') {
        text = await extractPdfText(await file.arrayBuffer());
      } else if (ext === 'docx') {
        text = await extractDocxText(await file.arrayBuffer());
      } else {
        text = await file.text();
      }
    } catch {
      setError(`Could not read ${file.name}`);
      return;
    }

    const { text: truncatedText, truncated } = truncateFileText(text);
    const content = `[File uploaded: ${file.name}]\n<uploaded_document>\n${truncatedText}\n</uploaded_document>`;
    const userMsg: PersonaMessage = { role: 'user', content };
    appendInterviewMessage(userMsg);

    if (truncated) {
      appendInterviewMessage({
        role: 'system',
        content: `⚠️ File was truncated to 500KB. The first 500KB was processed.`,
      });
    }

    const updatedMsgs = [...interviewMessages, userMsg];
    await sendToInterviewAI(updatedMsgs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, interviewMessages]);

  const handleBackToBuild = () => {
    const lastUserMsg = [...previewMessages].reverse().find(m => m.role === 'user')?.content ?? '';
    onBackToBuild(lastUserMsg);
  };

  return (
    <div data-testid="persona-builder-chat" className="persona-chat">
      {/* Header */}
      <div className="persona-chat-header">
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: agent?.color ?? '#6B7280', flexShrink: 0 }} />
        <span className="persona-chat-title">
          {mode === 'preview' ? `Preview: ${agent?.name}` : `Building ${agent?.name}`}
        </span>
        <span className="persona-chat-mode" style={{ marginLeft: 'auto' }}>
          {agent?.title}
        </span>
      </div>

      {/* Messages */}
      <div className="persona-chat-messages">
        {messages.length === 0 && !isStreaming && !streamingContent && (
          <div className="persona-chat-loading">
            <span className="persona-chat-loading-icon">🗄️</span>
            <span className="persona-chat-loading-text">
              Loading {agent?.name ?? 'agent'} persona builder…
            </span>
            <span className="persona-chat-spinner" />
          </div>
        )}
        {messages.filter(m => m.role !== 'system').map((msg, i) => (
          <div
            key={i}
            className={`persona-msg ${msg.role === 'user' ? 'persona-msg-user' : 'persona-msg-ai'}`}
          >
            <div className={`persona-msg-avatar ${msg.role === 'user' ? 'persona-msg-avatar-user' : 'persona-msg-avatar-ai'}`}>
              {msg.role === 'user' ? 'B' : 'AI'}
            </div>
            <div className={`persona-msg-bubble ${msg.role === 'user' ? 'persona-msg-bubble-user' : 'persona-msg-bubble-ai'}`}
              style={msg.content.startsWith('[File uploaded:') ? { fontStyle: 'italic', opacity: 0.6 } : undefined}
            >
              {msg.content.startsWith('[File uploaded:')
                ? msg.content.split('\n')[0]
                : msg.content}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && streamingContent && (
          <div className="persona-msg persona-msg-ai">
            <div className="persona-msg-avatar persona-msg-avatar-ai">AI</div>
            <div className="persona-msg-bubble persona-msg-bubble-ai">
              {streamingContent}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--accent-coral)', fontSize: 'var(--text-sm)', padding: 'var(--space-1) 0' }}>
            ⚠ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="persona-chat-input-area">
        {mode === 'preview' ? (
          <button className="modal-btn modal-btn-secondary" onClick={handleBackToBuild} style={{ flex: 'none', padding: '6px 12px' }}>
            ← Back to Build
          </button>
        ) : (
          <>
            <button
              className="modal-btn modal-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              style={{ flex: 'none', padding: '6px 12px', borderStyle: 'dashed' }}
            >
              📄 Upload file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.pdf,.docx"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e)}
            />
          </>
        )}
        <textarea
          className="persona-chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={
            mode === 'preview'
              ? `Ask ${agent?.name ?? 'the agent'} something…`
              : `Tell me about ${agent?.name ?? 'this agent'}…`
          }
          rows={1}
        />
        <button
          className="persona-chat-send"
          onClick={() => void handleSend()}
          disabled={isStreaming || !inputValue.trim()}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
