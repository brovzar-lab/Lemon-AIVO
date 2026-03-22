import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWarRoom } from '../useWarRoom';

// ---- Mocks ----

// Mock chatStore
const mockStore = {
  warRoomRound: 0,
  warRoomLastResponses: {} as Record<string, string>,
  warRoomStreaming: {
    patrik: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' as const },
    marcos: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' as const },
    sandra: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' as const },
    isaac: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' as const },
    wendy: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' as const },
  },
  isWarRoomMode: true,
  getOrCreateConversation: vi.fn().mockResolvedValue('conv-id'),
  addMessage: vi.fn().mockResolvedValue(undefined),
  startWarRoomStream: vi.fn(),
  updateWarRoomContent: vi.fn(),
  completeWarRoomStream: vi.fn(),
  failWarRoomStream: vi.fn(),
  cancelAllWarRoomStreams: vi.fn(),
  setWarRoomMode: vi.fn(),
  saveWarRoomLastResponses: vi.fn(),
  resetWarRoomStreaming: vi.fn(),
  conversations: {} as Record<string, unknown>,
};

vi.mock('@/store/chatStore', () => ({
  useChatStore: Object.assign(
    // Selector function: call selector with mockStore
    (selector: (s: typeof mockStore) => unknown) => selector(mockStore),
    {
      getState: () => mockStore,
    },
  ),
}));

// Capture stream callbacks per call
let streamCallbacks: Array<{
  agentId: string;
  callbacks: { onToken: (t: string) => void; onComplete: (c: string, u: { input_tokens: number; output_tokens: number }) => void; onError: (e: Error) => void };
  signal?: AbortSignal;
}> = [];

const mockSendStreamingMessage = vi.fn().mockImplementation(
  (agentId: string, _msgs: unknown, callbacks: unknown, signal?: AbortSignal) => {
    streamCallbacks.push({ agentId, callbacks: callbacks as typeof streamCallbacks[0]['callbacks'], signal });
    return Promise.resolve();
  },
);

vi.mock('@/services/anthropic/stream', () => ({
  sendStreamingMessage: (...args: unknown[]) => mockSendStreamingMessage(...args),
}));

const mockRetryWithBackoff = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());

vi.mock('@/services/anthropic/retryBackoff', () => ({
  retryWithBackoff: (...args: unknown[]) => mockRetryWithBackoff(...args),
}));

const mockBuildCrossVisibilityBlock = vi.fn().mockReturnValue('[War Room Context -- test]');

vi.mock('@/services/context/warRoomSummary', () => ({
  buildCrossVisibilityBlock: (...args: unknown[]) => mockBuildCrossVisibilityBlock(...args),
}));

const mockBuildContext = vi.fn().mockReturnValue({
  systemPrompt: 'test-system',
  messages: [{ role: 'user', content: 'test' }],
  totalTokens: 100,
});

vi.mock('@/services/context/builder', () => ({
  buildContext: (...args: unknown[]) => mockBuildContext(...args),
}));

// Mock gatherAgentsToWarRoom -- we don't test engine gathering in this hook test
vi.mock('@/engine/characters', () => ({
  gatherAgentsToWarRoom: vi.fn().mockResolvedValue(undefined),
  disperseAgentsToOffices: vi.fn(),
  WAR_ROOM_SEATS: {},
}));

vi.mock('@/store/officeStore', () => ({
  useOfficeStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector({ activeRoomId: 'war-room' }),
    {
      getState: () => ({
        activeRoomId: 'war-room',
        setAgentStatus: vi.fn(),
      }),
    },
  ),
}));

const AGENT_IDS = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'] as const;

describe('useWarRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamCallbacks = [];
    mockStore.warRoomRound = 0;
    mockStore.warRoomLastResponses = {} as Record<string, string>;
    mockStore.getOrCreateConversation = vi.fn().mockImplementation((id: string) => Promise.resolve(`conv-${id}`));
    mockStore.addMessage = vi.fn().mockResolvedValue(undefined);
    mockStore.conversations = {};
    // Populate conversations for each agent
    for (const id of AGENT_IDS) {
      mockStore.conversations[`conv-${id}`] = {
        id: `conv-${id}`,
        agentId: id,
        messages: [],
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  });

  it('Test 1 (broadcast): sendBroadcast calls getOrCreateConversation for all 5 agents, adds user messages, and fires 5 streams', async () => {
    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('test question');
    });

    // 5 conversations created
    expect(mockStore.getOrCreateConversation).toHaveBeenCalledTimes(5);
    for (const id of AGENT_IDS) {
      expect(mockStore.getOrCreateConversation).toHaveBeenCalledWith(id);
    }

    // 5 user messages added with source: 'war-room'
    expect(mockStore.addMessage).toHaveBeenCalledTimes(5);
    for (const call of (mockStore.addMessage as Mock).mock.calls) {
      expect(call[1]).toMatchObject({
        role: 'user',
        content: 'test question',
        source: 'war-room',
      });
    }

    // 5 streaming calls fired
    expect(mockSendStreamingMessage).toHaveBeenCalledTimes(5);
  });

  it('Test 2 (streaming callbacks): onToken accumulates content, onComplete stores assistant message', async () => {
    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('test question');
    });

    // Invoke onToken and onComplete for first captured callback (patrik)
    const patrikStream = streamCallbacks.find((s) => s.agentId === 'patrik');
    expect(patrikStream).toBeDefined();

    await act(async () => {
      patrikStream!.callbacks.onToken('Hello');
      patrikStream!.callbacks.onToken(' world');
    });

    // updateWarRoomContent should be called with accumulated content
    expect(mockStore.updateWarRoomContent).toHaveBeenCalledWith('patrik', 'Hello');
    expect(mockStore.updateWarRoomContent).toHaveBeenCalledWith('patrik', 'Hello world');

    await act(async () => {
      patrikStream!.callbacks.onComplete('Hello world', { input_tokens: 50, output_tokens: 10 });
    });

    // completeWarRoomStream should be called
    expect(mockStore.completeWarRoomStream).toHaveBeenCalledWith('patrik');

    // Assistant message added to conversation with source: 'war-room'
    const addMessageCalls = (mockStore.addMessage as Mock).mock.calls;
    const assistantCall = addMessageCalls.find(
      (call: unknown[]) =>
        (call[1] as { role: string }).role === 'assistant' &&
        (call[0] as string) === 'conv-patrik',
    );
    expect(assistantCall).toBeDefined();
    expect(assistantCall![1]).toMatchObject({
      role: 'assistant',
      content: 'Hello world',
      source: 'war-room',
    });
  });

  it('Test 3 (cancel): cancelAll calls cancelAllWarRoomStreams on chatStore', async () => {
    const { result } = renderHook(() => useWarRoom());

    act(() => {
      result.current.cancelAll();
    });

    expect(mockStore.cancelAllWarRoomStreams).toHaveBeenCalled();
  });

  it('Test 4 (mirroring): after broadcast, each agent conversation contains user AND assistant messages with source war-room', async () => {
    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('test question');
    });

    // Complete all 5 streams
    await act(async () => {
      for (const cb of streamCallbacks) {
        cb.callbacks.onComplete(`Response from ${cb.agentId}`, { input_tokens: 50, output_tokens: 10 });
      }
    });

    // Each agent should have both a user message and an assistant message
    // User messages: 5 (from broadcast) + Assistant messages: 5 (from onComplete) = 10 total
    expect(mockStore.addMessage).toHaveBeenCalledTimes(10);

    // Check assistant messages have source: 'war-room'
    const assistantCalls = (mockStore.addMessage as Mock).mock.calls.filter(
      (call: unknown[]) => (call[1] as { role: string }).role === 'assistant',
    );
    expect(assistantCalls).toHaveLength(5);
    for (const call of assistantCalls) {
      expect(call[1]).toMatchObject({ source: 'war-room' });
    }
  });

  it('Test 5 (partial failure): when 1 agent errors, failWarRoomStream is called for that agent while others complete', async () => {
    // Make patrik's stream fail
    mockSendStreamingMessage.mockImplementation(
      (agentId: string, _msgs: unknown, callbacks: unknown, signal?: AbortSignal) => {
        streamCallbacks.push({ agentId, callbacks: callbacks as typeof streamCallbacks[0]['callbacks'], signal });
        if (agentId === 'patrik') {
          return Promise.reject(new Error('Non-retryable error'));
        }
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('test question');
    });

    // failWarRoomStream should be called for patrik
    expect(mockStore.failWarRoomStream).toHaveBeenCalledWith('patrik', 'Non-retryable error');

    // Other agents should still be able to complete
    // (Promise.allSettled means all streams are attempted regardless)
    const otherStreams = streamCallbacks.filter((s) => s.agentId !== 'patrik');
    expect(otherStreams.length).toBeGreaterThanOrEqual(4);
  });

  it('Test 6 (retry on 429): when a stream returns 429 error, retryWithBackoff is invoked', async () => {
    const error429 = new Error('Rate limited');
    (error429 as Error & { status: number }).status = 429;

    // Make patrik's stream throw a 429 error initially
    mockSendStreamingMessage.mockImplementation(
      (agentId: string, _msgs: unknown, callbacks: unknown, signal?: AbortSignal) => {
        streamCallbacks.push({ agentId, callbacks: callbacks as typeof streamCallbacks[0]['callbacks'], signal });
        if (agentId === 'patrik') {
          return Promise.reject(error429);
        }
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('test question');
    });

    // retryWithBackoff should be called for patrik's 429 error
    expect(mockRetryWithBackoff).toHaveBeenCalled();
  });

  it('Test 7 (cross-visibility): on round > 1, buildCrossVisibilityBlock is called for each agent', async () => {
    mockStore.warRoomRound = 1;
    mockStore.warRoomLastResponses = {
      patrik: 'patrik previous',
      marcos: 'marcos previous',
      sandra: 'sandra previous',
      isaac: 'isaac previous',
      wendy: 'wendy previous',
    } as Record<string, string>;

    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('follow-up question');
    });

    // buildCrossVisibilityBlock should be called 5 times (once per agent)
    expect(mockBuildCrossVisibilityBlock).toHaveBeenCalledTimes(5);
    for (const id of AGENT_IDS) {
      expect(mockBuildCrossVisibilityBlock).toHaveBeenCalledWith(
        id,
        mockStore.warRoomLastResponses,
      );
    }
  });

  it('Test 8 (save responses): after Promise.allSettled resolves, saveWarRoomLastResponses is called', async () => {
    const { result } = renderHook(() => useWarRoom());

    await act(async () => {
      await result.current.sendBroadcast('test question');
    });

    expect(mockStore.saveWarRoomLastResponses).toHaveBeenCalled();
  });
});
