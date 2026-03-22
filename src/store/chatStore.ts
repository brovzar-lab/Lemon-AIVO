import { create } from 'zustand';
import type { AgentId } from '@/types/agent';
import type { Conversation, Message, StreamingState, WarRoomAgentStream } from '@/types/chat';
import { getPersistence } from '@/services/persistence/adapter';
import { useDealStore } from '@/store/dealStore';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];

function createEmptyWarRoomStreaming(): Record<AgentId, WarRoomAgentStream> {
  return {
    patrik: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' },
    marcos: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' },
    sandra: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' },
    isaac: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' },
    wendy: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' },
    charlie: { isStreaming: false, currentContent: '', error: null, abortController: null, status: 'idle' },
  };
}

interface ChatState {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  streaming: StreamingState;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  getOrCreateConversation: (agentId: AgentId) => Promise<string>;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  updateStreamingContent: (content: string) => void;
  startStreaming: (abortController: AbortController) => void;
  stopStreaming: () => void;
  setError: (error: string | null) => void;
  updateConversationTokens: (conversationId: string, tokens: number) => void;
  setConversationSummary: (conversationId: string, summary: string, summaryTokens: number) => void;

  // War Room parallel streaming
  isWarRoomMode: boolean;
  warRoomStreaming: Record<AgentId, WarRoomAgentStream>;
  warRoomRound: number;
  warRoomLastResponses: Record<AgentId, string>;

  // War Room actions
  startWarRoomStream: (agentId: AgentId, abortController: AbortController) => void;
  updateWarRoomContent: (agentId: AgentId, content: string) => void;
  completeWarRoomStream: (agentId: AgentId) => void;
  failWarRoomStream: (agentId: AgentId, error: string) => void;
  cancelAllWarRoomStreams: () => void;
  setWarRoomMode: (active: boolean, round?: number) => void;
  saveWarRoomLastResponses: () => void;
  resetWarRoomStreaming: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  activeConversationId: null,
  streaming: {
    isStreaming: false,
    currentContent: '',
    abortController: null,
  },
  error: null,

  // War Room initial state
  isWarRoomMode: false,
  warRoomStreaming: createEmptyWarRoomStreaming(),
  warRoomRound: 0,
  warRoomLastResponses: {} as Record<AgentId, string>,

  loadConversations: async () => {
    const dealId = useDealStore.getState().activeDealId;
    if (!dealId) {
      set({ conversations: {}, activeConversationId: null });
      return;
    }

    const persistence = getPersistence();
    const conversations = await persistence.query<Conversation>('conversations', 'dealId', dealId);
    const conversationMap: Record<string, Conversation> = {};

    for (const conv of conversations) {
      // Load messages for each conversation
      const messages = await persistence.query<Message>('messages', 'conversationId', conv.id);
      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);
      conversationMap[conv.id] = { ...conv, messages };
    }

    set({ conversations: conversationMap, activeConversationId: null });
  },

  getOrCreateConversation: async (agentId: AgentId) => {
    const { conversations } = get();
    const dealId = useDealStore.getState().activeDealId;

    // Check if a conversation for this agent in this deal already exists
    const existing = Object.values(conversations).find(
      (conv) => conv.agentId === agentId && conv.dealId === dealId
    );
    if (existing) {
      set({ activeConversationId: existing.id });
      return existing.id;
    }

    // Create a new conversation with dealId
    const now = Date.now();
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      agentId,
      dealId: dealId ?? undefined,
      messages: [],
      totalTokens: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to IndexedDB
    const persistence = getPersistence();
    await persistence.set('conversations', newConversation.id, newConversation);

    set((state) => ({
      conversations: {
        ...state.conversations,
        [newConversation.id]: newConversation,
      },
      activeConversationId: newConversation.id,
    }));

    return newConversation.id;
  },

  addMessage: async (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const fullMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Persist message to IndexedDB
    const persistence = getPersistence();
    await persistence.set('messages', fullMessage.id, fullMessage);

    // Update conversation in state
    set((state) => {
      const conversation = state.conversations[conversationId];
      if (!conversation) return state;

      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, fullMessage],
        updatedAt: Date.now(),
      };

      // Persist updated conversation metadata (without messages array to avoid duplication)
      const { messages: _messages, ...convMetadata } = updatedConversation;
      void persistence.set('conversations', conversationId, { ...convMetadata, messages: [] });

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: updatedConversation,
        },
      };
    });
  },

  updateStreamingContent: (content: string) => {
    set((state) => ({
      streaming: { ...state.streaming, currentContent: content },
    }));
  },

  startStreaming: (abortController: AbortController) => {
    set({
      streaming: {
        isStreaming: true,
        currentContent: '',
        abortController,
      },
      error: null,
    });
  },

  stopStreaming: () => {
    set((state) => ({
      streaming: {
        ...state.streaming,
        isStreaming: false,
        currentContent: '',
        abortController: null,
      },
    }));
  },

  setError: (error: string | null) => {
    set({ error });
  },

  updateConversationTokens: (conversationId: string, tokens: number) => {
    set((state) => {
      const conversation = state.conversations[conversationId];
      if (!conversation) return state;

      const updatedConversation: Conversation = {
        ...conversation,
        totalTokens: tokens,
      };

      // Persist token count update
      const persistence = getPersistence();
      const { messages: _messages, ...convMetadata } = updatedConversation;
      void persistence.set('conversations', conversationId, { ...convMetadata, messages: [] });

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: updatedConversation,
        },
      };
    });
  },

  setConversationSummary: (conversationId: string, summary: string, summaryTokens: number) => {
    set((state) => {
      const conversation = state.conversations[conversationId];
      if (!conversation) return state;

      const updatedConversation: Conversation = {
        ...conversation,
        summary,
        summaryTokens,
      };

      // Persist summary update
      const persistence = getPersistence();
      const { messages: _messages, ...convMetadata } = updatedConversation;
      void persistence.set('conversations', conversationId, { ...convMetadata, messages: [] });

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: updatedConversation,
        },
      };
    });
  },

  // War Room actions

  startWarRoomStream: (agentId: AgentId, abortController: AbortController) => {
    set((state) => ({
      warRoomStreaming: {
        ...state.warRoomStreaming,
        [agentId]: {
          isStreaming: true,
          currentContent: '',
          error: null,
          abortController,
          status: 'streaming' as const,
        },
      },
    }));
  },

  updateWarRoomContent: (agentId: AgentId, content: string) => {
    set((state) => ({
      warRoomStreaming: {
        ...state.warRoomStreaming,
        [agentId]: {
          ...state.warRoomStreaming[agentId],
          currentContent: content,
        },
      },
    }));
  },

  completeWarRoomStream: (agentId: AgentId) => {
    set((state) => ({
      warRoomStreaming: {
        ...state.warRoomStreaming,
        [agentId]: {
          ...state.warRoomStreaming[agentId],
          isStreaming: false,
          abortController: null,
          status: 'complete' as const,
        },
      },
    }));
  },

  failWarRoomStream: (agentId: AgentId, error: string) => {
    set((state) => ({
      warRoomStreaming: {
        ...state.warRoomStreaming,
        [agentId]: {
          ...state.warRoomStreaming[agentId],
          isStreaming: false,
          error,
          status: 'error' as const,
        },
      },
    }));
  },

  cancelAllWarRoomStreams: () => {
    set((state) => {
      // Abort all active controllers
      for (const agentId of AGENT_IDS) {
        state.warRoomStreaming[agentId].abortController?.abort();
      }
      return {
        warRoomStreaming: createEmptyWarRoomStreaming(),
        isWarRoomMode: false,
      };
    });
  },

  setWarRoomMode: (active: boolean, round?: number) => {
    set((state) => ({
      isWarRoomMode: active,
      warRoomRound: round !== undefined ? round : state.warRoomRound,
      // Reset streaming state when activating
      ...(active ? { warRoomStreaming: createEmptyWarRoomStreaming() } : {}),
    }));
  },

  saveWarRoomLastResponses: () => {
    set((state) => {
      const responses = {} as Record<AgentId, string>;
      for (const agentId of AGENT_IDS) {
        responses[agentId] = state.warRoomStreaming[agentId].currentContent;
      }
      return { warRoomLastResponses: responses };
    });
  },

  resetWarRoomStreaming: () => {
    set({ warRoomStreaming: createEmptyWarRoomStreaming() });
  },
}));
