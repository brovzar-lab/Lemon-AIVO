/**
 * One-time purge of old fake chat data.
 *
 * Uses a localStorage version flag to ensure this runs exactly once.
 * After the purge, all future conversations and activity persist normally.
 */
import { getPersistence } from '@/services/persistence/adapter';

const DATA_VERSION_KEY = 'lemon-data-version';
const CURRENT_VERSION = 2;

/**
 * Clears old fake/test conversations and messages from IndexedDB.
 * Gated by a localStorage version flag — runs once, then never again.
 */
export async function purgeOldFakeData(): Promise<void> {
  const storedVersion = parseInt(localStorage.getItem(DATA_VERSION_KEY) ?? '0', 10);

  if (storedVersion >= CURRENT_VERSION) return; // already purged

  const persistence = getPersistence();

  // Clear all conversations and messages (old fake auto-generated data)
  await persistence.clear('conversations');
  await persistence.clear('messages');

  // Mark as purged so this never runs again
  localStorage.setItem(DATA_VERSION_KEY, String(CURRENT_VERSION));

  console.info('[clearData] Purged old fake chat data (one-time migration v%d)', CURRENT_VERSION);
}
