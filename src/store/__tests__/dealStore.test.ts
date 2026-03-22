import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Deal } from '@/types/deal';

// Mock persistence layer
const mockPersistence = {
  getAll: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  bulkSet: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/services/persistence/adapter', () => ({
  getPersistence: () => mockPersistence,
}));

// Mock chatStore for switchDeal cross-store calls
const mockLoadConversations = vi.fn().mockResolvedValue(undefined);
const mockStopStreaming = vi.fn();
vi.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: () => ({
      loadConversations: mockLoadConversations,
      streaming: { isStreaming: false, abortController: null },
      stopStreaming: mockStopStreaming,
    }),
  },
}));

// Import dealStore after mocks
import { useDealStore } from '../dealStore';

describe('dealStore CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useDealStore.setState({
      activeDealId: null,
      deals: [],
    });
  });

  it('createDeal("Oro Verde - Netflix") -> deal appears in store.deals with name, id, timestamps, status=active', async () => {
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Oro Verde - Netflix');

    const state = useDealStore.getState();
    expect(state.deals).toHaveLength(1);

    const deal = state.deals[0]!;
    expect(deal.name).toBe('Oro Verde - Netflix');
    expect(deal.id).toBe(dealId);
    expect(deal.status).toBe('active');
    expect(deal.createdAt).toBeGreaterThan(0);
    expect(deal.updatedAt).toBeGreaterThan(0);
    expect(mockPersistence.set).toHaveBeenCalledWith('deals', dealId, expect.objectContaining({ name: 'Oro Verde - Netflix' }));
  });

  it('createDeal("Oro Verde", "Netflix MX limited series") -> deal has description field', async () => {
    const store = useDealStore.getState();
    await store.createDeal('Oro Verde', 'Netflix MX limited series');

    const state = useDealStore.getState();
    const deal = state.deals[0]!;
    expect(deal.description).toBe('Netflix MX limited series');
  });

  it('loadDeals() -> deals loaded from IndexedDB sorted by updatedAt descending', async () => {
    const now = Date.now();
    const deals: Deal[] = [
      { id: 'deal-1', name: 'Old Deal', status: 'active', createdAt: now - 2000, updatedAt: now - 2000 },
      { id: 'deal-2', name: 'New Deal', status: 'active', createdAt: now - 1000, updatedAt: now },
    ];
    mockPersistence.getAll.mockResolvedValueOnce(deals);

    const store = useDealStore.getState();
    await store.loadDeals();

    const state = useDealStore.getState();
    expect(state.deals).toHaveLength(2);
    expect(state.deals[0]!.name).toBe('New Deal');
    expect(state.deals[1]!.name).toBe('Old Deal');
  });

  it('renameDeal(dealId, "New Name") -> deal name updated in state and persisted', async () => {
    // Seed a deal
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Old Name');
    vi.clearAllMocks();

    await useDealStore.getState().renameDeal(dealId, 'New Name');

    const state = useDealStore.getState();
    const deal = state.deals.find(d => d.id === dealId);
    expect(deal?.name).toBe('New Name');
    expect(mockPersistence.set).toHaveBeenCalledWith('deals', dealId, expect.objectContaining({ name: 'New Name' }));
  });

  it('updateDealDescription(dealId, "new desc") -> description updated', async () => {
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Test Deal');
    vi.clearAllMocks();

    await useDealStore.getState().updateDealDescription(dealId, 'new desc');

    const state = useDealStore.getState();
    const deal = state.deals.find(d => d.id === dealId);
    expect(deal?.description).toBe('new desc');
    expect(mockPersistence.set).toHaveBeenCalledWith('deals', dealId, expect.objectContaining({ description: 'new desc' }));
  });

  it('archiveDeal(dealId) -> deal status becomes archived', async () => {
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Test Deal');

    await useDealStore.getState().archiveDeal(dealId);

    const state = useDealStore.getState();
    const deal = state.deals.find(d => d.id === dealId);
    expect(deal?.status).toBe('archived');
  });

  it('softDeleteDeal(dealId) -> deal status becomes deleted, deletedAt is set', async () => {
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Test Deal');

    await useDealStore.getState().softDeleteDeal(dealId);

    const state = useDealStore.getState();
    const deal = state.deals.find(d => d.id === dealId);
    expect(deal?.status).toBe('deleted');
    expect(deal?.deletedAt).toBeGreaterThan(0);
  });

  it('switchDeal(dealId) -> activeDealId updated, chatStore.loadConversations called', async () => {
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Test Deal');

    await useDealStore.getState().switchDeal(dealId);

    const state = useDealStore.getState();
    expect(state.activeDealId).toBe(dealId);
    expect(mockLoadConversations).toHaveBeenCalled();
  });

  it('switchDeal aborts in-flight streaming before switching', async () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');

    // Override chatStore mock to report active streaming
    const { useChatStore: chatMock } = await import('@/store/chatStore');
    const originalGetState = chatMock.getState;
    vi.mocked(chatMock).getState = () => ({
      ...originalGetState(),
      streaming: { isStreaming: true, currentContent: 'partial', abortController: controller },
      stopStreaming: mockStopStreaming,
      loadConversations: mockLoadConversations,
    });

    const store = useDealStore.getState();
    const dealId = await store.createDeal('Test');
    await useDealStore.getState().switchDeal(dealId);

    expect(abortSpy).toHaveBeenCalled();
    expect(mockStopStreaming).toHaveBeenCalled();

    // Restore
    vi.mocked(chatMock).getState = originalGetState;
  });

  it('ensureDefaultDeal() -> creates "General" deal if no deals exist, sets it active', async () => {
    const store = useDealStore.getState();
    await store.ensureDefaultDeal();

    const state = useDealStore.getState();
    expect(state.deals).toHaveLength(1);
    expect(state.deals[0]!.name).toBe('General');
    expect(state.deals[0]!.id).toBe('default');
    expect(state.activeDealId).toBe('default');
    expect(mockPersistence.set).toHaveBeenCalledWith('deals', 'default', expect.objectContaining({ name: 'General' }));
  });

  it('ensureDefaultDeal() -> no-op if deals already exist', async () => {
    const store = useDealStore.getState();
    await store.createDeal('Existing Deal');
    vi.clearAllMocks();

    await useDealStore.getState().ensureDefaultDeal();

    const state = useDealStore.getState();
    expect(state.deals).toHaveLength(1);
    expect(state.deals[0]!.name).toBe('Existing Deal');
    expect(mockPersistence.set).not.toHaveBeenCalled();
  });

  it('deleteDealCascade(dealId) -> removes deal + its conversations + their messages from IndexedDB', async () => {
    const store = useDealStore.getState();
    const dealId = await store.createDeal('Doomed Deal');

    // Mock conversations belonging to this deal
    const convs = [
      { id: 'conv-1', agentId: 'patrik', dealId, messages: [] },
      { id: 'conv-2', agentId: 'marcos', dealId, messages: [] },
    ];
    mockPersistence.query.mockResolvedValueOnce(convs);
    // Mock messages for conv-1
    mockPersistence.query.mockResolvedValueOnce([
      { id: 'msg-1', conversationId: 'conv-1' },
      { id: 'msg-2', conversationId: 'conv-1' },
    ]);
    // Mock messages for conv-2
    mockPersistence.query.mockResolvedValueOnce([
      { id: 'msg-3', conversationId: 'conv-2' },
    ]);

    await useDealStore.getState().deleteDealCascade(dealId);

    // Messages deleted
    expect(mockPersistence.delete).toHaveBeenCalledWith('messages', 'msg-1');
    expect(mockPersistence.delete).toHaveBeenCalledWith('messages', 'msg-2');
    expect(mockPersistence.delete).toHaveBeenCalledWith('messages', 'msg-3');
    // Conversations deleted
    expect(mockPersistence.delete).toHaveBeenCalledWith('conversations', 'conv-1');
    expect(mockPersistence.delete).toHaveBeenCalledWith('conversations', 'conv-2');
    // Deal deleted
    expect(mockPersistence.delete).toHaveBeenCalledWith('deals', dealId);

    // Deal removed from state
    const state = useDealStore.getState();
    expect(state.deals.find(d => d.id === dealId)).toBeUndefined();
  });
});

describe('migrateConversationsToDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDealStore.setState({ activeDealId: null, deals: [] });
  });

  it('migrateConversationsToDeals() with orphan conversations -> creates General deal, stamps all with dealId', async () => {
    const { migrateConversationsToDeals } = await import('@/services/persistence/migration');

    // Mock: no deals exist, orphan conversations exist
    mockPersistence.getAll
      .mockResolvedValueOnce([]) // deals
      .mockResolvedValueOnce([   // conversations without dealId
        { id: 'conv-1', agentId: 'patrik', messages: [] },
        { id: 'conv-2', agentId: 'marcos', messages: [] },
      ]);

    await migrateConversationsToDeals();

    // Should have created the default deal
    expect(mockPersistence.set).toHaveBeenCalledWith('deals', 'default', expect.objectContaining({ name: 'General', id: 'default' }));
    // Should have stamped orphan conversations
    expect(mockPersistence.bulkSet).toHaveBeenCalledWith('conversations', expect.arrayContaining([
      expect.objectContaining({ key: 'conv-1', value: expect.objectContaining({ dealId: 'default' }) }),
      expect.objectContaining({ key: 'conv-2', value: expect.objectContaining({ dealId: 'default' }) }),
    ]));
  });

  it('migrateConversationsToDeals() with no orphans -> no-op', async () => {
    const { migrateConversationsToDeals } = await import('@/services/persistence/migration');

    // Mock: deals exist, all conversations have dealId
    mockPersistence.getAll
      .mockResolvedValueOnce([{ id: 'deal-1', name: 'Existing' }]) // deals exist
      .mockResolvedValueOnce([
        { id: 'conv-1', agentId: 'patrik', dealId: 'deal-1', messages: [] },
      ]);

    await migrateConversationsToDeals();

    // No new deal created, no bulk update
    expect(mockPersistence.set).not.toHaveBeenCalledWith('deals', 'default', expect.anything());
    expect(mockPersistence.bulkSet).not.toHaveBeenCalled();
  });
});
