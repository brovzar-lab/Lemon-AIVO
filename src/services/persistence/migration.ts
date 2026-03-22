import type { Deal } from '@/types/deal';
import type { Conversation } from '@/types/chat';
import { getPersistence } from '@/services/persistence/adapter';

/**
 * Migrates legacy conversations that lack a dealId to the default "General" deal.
 *
 * - If no deals exist and orphan conversations are found, creates a "General" deal with id='default'
 * - Stamps all orphan conversations with dealId='default' via bulkSet
 * - No-op if all conversations already have a dealId or no conversations exist
 */
export async function migrateConversationsToDeals(): Promise<void> {
  const persistence = getPersistence();

  // Check if deals exist
  const deals = await persistence.getAll<Deal>('deals');
  const conversations = await persistence.getAll<Conversation>('conversations');

  // Find orphan conversations (those without a dealId)
  const orphans = conversations.filter(conv => !conv.dealId);

  if (orphans.length === 0) {
    return; // No migration needed
  }

  // Ensure a default deal exists
  const defaultDealExists = deals.some(d => d.id === 'default');
  if (!defaultDealExists) {
    const now = Date.now();
    const defaultDeal: Deal = {
      id: 'default',
      name: 'General',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await persistence.set('deals', defaultDeal.id, defaultDeal);
  }

  // Stamp all orphan conversations with dealId='default'
  const entries = orphans.map(conv => ({
    key: conv.id,
    value: { ...conv, dealId: 'default' },
  }));

  await persistence.bulkSet('conversations', entries);
}
