import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../chatStore';
import type { AgentId } from '@/types/agent';
import type { Message } from '@/types/chat';

// Mock persistence layer so chatStore can initialize
vi.mock('@/services/persistence/adapter', () => ({
  getPersistence: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
  }),
}));

describe('chatStore War Room multi-stream state', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useChatStore.setState({
      isWarRoomMode: false,
      warRoomStreaming: useChatStore.getState().resetWarRoomStreaming
        ? (() => {
            useChatStore.getState().resetWarRoomStreaming();
            return useChatStore.getState().warRoomStreaming;
          })()
        : ({} as Record<AgentId, any>),
      warRoomRound: 0,
      warRoomLastResponses: {} as Record<AgentId, string>,
    });
  });

  it('Test 1: startWarRoomStream sets agent to streaming state with controller', () => {
    const store = useChatStore.getState();
    const controller = new AbortController();

    store.startWarRoomStream('patrik', controller);

    const state = useChatStore.getState();
    expect(state.warRoomStreaming.patrik).toEqual({
      isStreaming: true,
      currentContent: '',
      error: null,
      abortController: controller,
      status: 'streaming',
    });
  });

  it('Test 2: updateWarRoomContent updates only the specified agent', () => {
    const store = useChatStore.getState();
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    store.startWarRoomStream('patrik', controller1);
    store.startWarRoomStream('marcos', controller2);
    store.updateWarRoomContent('patrik', 'hello');

    const state = useChatStore.getState();
    expect(state.warRoomStreaming.patrik.currentContent).toBe('hello');
    expect(state.warRoomStreaming.marcos.currentContent).toBe('');
  });

  it('Test 3: completeWarRoomStream sets status to complete and isStreaming to false', () => {
    const store = useChatStore.getState();
    const controller = new AbortController();

    store.startWarRoomStream('patrik', controller);
    store.completeWarRoomStream('patrik');

    const state = useChatStore.getState();
    expect(state.warRoomStreaming.patrik.status).toBe('complete');
    expect(state.warRoomStreaming.patrik.isStreaming).toBe(false);
    expect(state.warRoomStreaming.patrik.abortController).toBeNull();
  });

  it('Test 4: failWarRoomStream sets status to error and error message', () => {
    const store = useChatStore.getState();
    const controller = new AbortController();

    store.startWarRoomStream('patrik', controller);
    store.failWarRoomStream('patrik', 'Rate limited');

    const state = useChatStore.getState();
    expect(state.warRoomStreaming.patrik.status).toBe('error');
    expect(state.warRoomStreaming.patrik.error).toBe('Rate limited');
    expect(state.warRoomStreaming.patrik.isStreaming).toBe(false);
  });

  it('Test 5: cancelAllWarRoomStreams aborts all active controllers and resets', () => {
    const store = useChatStore.getState();

    // Set war room mode first (resets streaming), then start streams
    store.setWarRoomMode(true, 1);

    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const controller3 = new AbortController();

    store.startWarRoomStream('patrik', controller1);
    store.startWarRoomStream('marcos', controller2);
    store.startWarRoomStream('sandra', controller3);

    // Verify controllers are active before cancel
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller3.signal.aborted).toBe(false);

    store.cancelAllWarRoomStreams();

    // Controllers should be aborted
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(true);

    const state = useChatStore.getState();
    expect(state.isWarRoomMode).toBe(false);

    // All streams should be reset to idle
    const agents: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];
    for (const agentId of agents) {
      expect(state.warRoomStreaming[agentId].status).toBe('idle');
      expect(state.warRoomStreaming[agentId].isStreaming).toBe(false);
      expect(state.warRoomStreaming[agentId].abortController).toBeNull();
    }
  });

  it('Test 6: setWarRoomMode sets isWarRoomMode and warRoomRound', () => {
    const store = useChatStore.getState();

    store.setWarRoomMode(true, 3);

    const state = useChatStore.getState();
    expect(state.isWarRoomMode).toBe(true);
    expect(state.warRoomRound).toBe(3);
  });

  it('Test 6b: setWarRoomMode(true) resets streaming state', () => {
    const store = useChatStore.getState();
    const controller = new AbortController();

    // Start a stream first
    store.startWarRoomStream('patrik', controller);
    store.updateWarRoomContent('patrik', 'old content');

    // Activate war room mode - should reset streaming
    store.setWarRoomMode(true, 1);

    const state = useChatStore.getState();
    expect(state.warRoomStreaming.patrik.currentContent).toBe('');
    expect(state.warRoomStreaming.patrik.status).toBe('idle');
  });

  it('Test 7: Message type accepts optional source field', () => {
    const message: Message = {
      id: 'test-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Test content',
      timestamp: Date.now(),
      source: 'war-room',
    };

    expect(message.source).toBe('war-room');

    // Direct source should also be valid
    const directMessage: Message = {
      id: 'test-2',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      source: 'direct',
    };

    expect(directMessage.source).toBe('direct');

    // No source should also be valid (backward compatibility)
    const noSourceMessage: Message = {
      id: 'test-3',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hi',
      timestamp: Date.now(),
    };

    expect(noSourceMessage.source).toBeUndefined();
  });

  it('saveWarRoomLastResponses copies currentContent into warRoomLastResponses', () => {
    const store = useChatStore.getState();
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    store.startWarRoomStream('patrik', controller1);
    store.startWarRoomStream('marcos', controller2);
    store.updateWarRoomContent('patrik', 'Patrik response text');
    store.updateWarRoomContent('marcos', 'Marcos response text');
    store.completeWarRoomStream('patrik');
    store.completeWarRoomStream('marcos');

    store.saveWarRoomLastResponses();

    const state = useChatStore.getState();
    expect(state.warRoomLastResponses.patrik).toBe('Patrik response text');
    expect(state.warRoomLastResponses.marcos).toBe('Marcos response text');
  });

  it('resetWarRoomStreaming resets all streams to idle', () => {
    const store = useChatStore.getState();
    const controller = new AbortController();

    store.startWarRoomStream('patrik', controller);
    store.updateWarRoomContent('patrik', 'content');

    store.resetWarRoomStreaming();

    const state = useChatStore.getState();
    const agents: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];
    for (const agentId of agents) {
      expect(state.warRoomStreaming[agentId].status).toBe('idle');
      expect(state.warRoomStreaming[agentId].isStreaming).toBe(false);
      expect(state.warRoomStreaming[agentId].currentContent).toBe('');
      expect(state.warRoomStreaming[agentId].error).toBeNull();
      expect(state.warRoomStreaming[agentId].abortController).toBeNull();
    }
  });

  it('existing chatStore functionality is not affected', () => {
    const store = useChatStore.getState();

    // Check existing fields still exist
    expect(store.conversations).toBeDefined();
    expect(store.activeConversationId).toBeNull();
    expect(store.streaming).toBeDefined();
    expect(store.streaming.isStreaming).toBe(false);
    expect(store.error).toBeNull();

    // Check existing actions still exist
    expect(typeof store.loadConversations).toBe('function');
    expect(typeof store.getOrCreateConversation).toBe('function');
    expect(typeof store.addMessage).toBe('function');
    expect(typeof store.updateStreamingContent).toBe('function');
    expect(typeof store.startStreaming).toBe('function');
    expect(typeof store.stopStreaming).toBe('function');
    expect(typeof store.setError).toBe('function');
    expect(typeof store.updateConversationTokens).toBe('function');
    expect(typeof store.setConversationSummary).toBe('function');
  });
});
