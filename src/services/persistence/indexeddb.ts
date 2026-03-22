import { openDB, type IDBPDatabase } from 'idb';
import type { PersistenceAdapter, StoreName } from '@/types/persistence';

const DB_NAME = 'lemon-command-center';
const DB_VERSION = 3; // v2: collaborations, v3: activity log

export class IndexedDBAdapter implements PersistenceAdapter {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
    this.requestPersistence();
  }

  private async initDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // -- Version 1 stores (create on fresh install) --
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('agentId', 'agentId', { unique: false });
          convStore.createIndex('dealId', 'dealId', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        }

        if (!db.objectStoreNames.contains('deals')) {
          db.createObjectStore('deals', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('agentId', 'agentId', { unique: false });
          fileStore.createIndex('dealId', 'dealId', { unique: false });
        }

        if (!db.objectStoreNames.contains('memory')) {
          const memStore = db.createObjectStore('memory', { keyPath: 'id' });
          memStore.createIndex('agentId', 'agentId', { unique: false });
          memStore.createIndex('dealId', 'dealId', { unique: false });
        }

        // -- Version 2 stores (Phase 17: collaboration chain snapshots) --
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('collaborations')) {
            const collabStore = db.createObjectStore('collaborations', { keyPath: 'id' });
            collabStore.createIndex('dealId', 'dealId', { unique: false });
            collabStore.createIndex('status', 'status', { unique: false });
          }
        }

        // -- Version 3 stores: persistent activity log --
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('activity')) {
            db.createObjectStore('activity', { keyPath: 'id' });
          }
        }
      },
      blocked() {
        // Another tab is holding an old DB version open — reload to retry
        console.warn('[IndexedDB] Upgrade blocked by another tab. Reloading...');
        window.location.reload();
      },
    });
  }

  private requestPersistence(): void {
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {
        // Persistence request denied or unavailable — non-critical
      });
    }
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.dbPromise;
    return db.get(store, key) as Promise<T | undefined>;
  }

  async set<T>(store: StoreName, _key: string, value: T): Promise<void> {
    const db = await this.dbPromise;
    // Key is embedded in value via keyPath on all object stores
    await db.put(store, value);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(store, key);
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.dbPromise;
    return db.getAll(store) as Promise<T[]>;
  }

  async query<T>(store: StoreName, indexName: string, value: string): Promise<T[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex(store, indexName, value) as Promise<T[]>;
  }

  async bulkSet<T>(store: StoreName, entries: Array<{ key: string; value: T }>): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    for (const entry of entries) {
      await objectStore.put(entry.value);
    }
    await tx.done;
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(store);
  }
}
