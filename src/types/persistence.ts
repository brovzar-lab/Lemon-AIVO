export type StoreName = 'conversations' | 'messages' | 'deals' | 'files' | 'memory' | 'collaborations' | 'activity';

export interface PersistenceAdapter {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  set<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  getAll<T>(store: StoreName): Promise<T[]>;
  query<T>(store: StoreName, indexName: string, value: string): Promise<T[]>;
  bulkSet<T>(store: StoreName, entries: Array<{ key: string; value: T }>): Promise<void>;
  clear(store: StoreName): Promise<void>;
}
