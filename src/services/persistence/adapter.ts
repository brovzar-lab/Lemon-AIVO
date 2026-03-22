import type { PersistenceAdapter } from '@/types/persistence';
import { IndexedDBAdapter } from './indexeddb';

let instance: PersistenceAdapter | null = null;

export function getPersistence(): PersistenceAdapter {
  if (!instance) {
    instance = new IndexedDBAdapter();
  }
  return instance;
}

export type { PersistenceAdapter };
