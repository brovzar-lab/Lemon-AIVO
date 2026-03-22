/**
 * Persistent activity log store.
 *
 * Logs real events (chat responses, boardroom meetings, water cooler trips, etc.)
 * and persists them in IndexedDB so they survive page reloads.
 */
import { create } from 'zustand';
import { getPersistence } from '@/services/persistence/adapter';

const MAX_ENTRIES = 50;

export interface ActivityEntry {
  id: string;
  timestamp: number;
  time: string;      // formatted display time (e.g. "14:32")
  agentName: string;
  text: string;
}

interface ActivityState {
  entries: ActivityEntry[];
  logActivity: (agentName: string, text: string) => void;
  loadActivities: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  entries: [],

  logActivity: (agentName: string, text: string) => {
    const now = new Date();
    const entry: ActivityEntry = {
      id: `act-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now.getTime(),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      agentName,
      text,
    };

    // Update store (newest first, cap at MAX_ENTRIES)
    const updated = [entry, ...get().entries].slice(0, MAX_ENTRIES);
    set({ entries: updated });

    // Persist (fire-and-forget)
    const persistence = getPersistence();
    void persistence.set('activity', entry.id, entry);

    // Prune oldest entries from IndexedDB if over cap
    if (updated.length >= MAX_ENTRIES) {
      const toRemove = get().entries.slice(MAX_ENTRIES);
      for (const old of toRemove) {
        void persistence.delete('activity', old.id);
      }
    }
  },

  loadActivities: async () => {
    const persistence = getPersistence();
    const all = await persistence.getAll<ActivityEntry>('activity');

    // Sort by timestamp descending (newest first)
    all.sort((a, b) => b.timestamp - a.timestamp);

    set({ entries: all.slice(0, MAX_ENTRIES) });
  },
}));
