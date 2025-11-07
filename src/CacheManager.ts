import { CacheError, PersistentCache, PersistentCacheEntry, PersistentCacheSchema, TweetHash } from './types';
import { getLocalStorage, setLocalStorage } from './storage';

/**
 * Manages two-level caching for tweet toxicity results:
 * 1. In-memory Map for fast access during session
 * 2. Persistent chrome.storage for cross-session caching
 *
 * The persistent cache has a size limit and uses FIFO eviction
 */
export class CacheManager {
  private memoryCache: Map<string, boolean> = new Map();
  private persistentCacheSize = 0;
  private readonly maxPersistentCacheSize: number;

  /**
   * @param maxPersistentCacheSize - Maximum size in bytes for persistent cache (default: 500KB)
   */
  constructor(maxPersistentCacheSize = 500000) {
    this.maxPersistentCacheSize = maxPersistentCacheSize;
  }

  /**
   * Retrieves a cached result for a tweet hash
   * Checks memory cache first, then falls back to persistent storage
   *
   * @param hash - The tweet hash to lookup
   * @returns The cached toxicity result, or undefined if not cached
   */
  async get(hash: TweetHash): Promise<boolean | undefined> {
    // Check memory cache first
    const memoryResult = this.memoryCache.get(hash);
    if (memoryResult !== undefined) {
      return memoryResult;
    }

    // Fall back to persistent cache
    const persistentCache = await this.loadPersistentCache();
    const entry = persistentCache[hash];

    if (entry !== undefined) {
      // Warm up memory cache
      this.memoryCache.set(hash, entry.toxic);
      return entry.toxic;
    }

    return undefined;
  }

  /**
   * Retrieves the full cache entry including reasoning for a tweet hash
   * Only checks persistent storage (reasoning not stored in memory cache)
   *
   * @param hash - The tweet hash to lookup
   * @returns The full cache entry, or undefined if not cached
   */
  async getEntry(hash: TweetHash): Promise<PersistentCacheEntry | undefined> {
    const persistentCache = await this.loadPersistentCache();
    return persistentCache[hash];
  }

  /**
   * Stores a toxicity result for a tweet hash
   * Updates both memory and persistent caches
   *
   * @param hash - The tweet hash
   * @param toxic - Whether the tweet is toxic
   * @param reasoning - Optional AI reasoning for the classification
   */
  async set(hash: TweetHash, toxic: boolean, reasoning?: string): Promise<void> {
    // Update memory cache
    this.memoryCache.set(hash, toxic);

    // Update persistent cache
    const persistentCache = await this.loadPersistentCache();
    persistentCache[hash] = {
      toxic,
      timestamp: Date.now(),
      ...(reasoning ? { reasoning } : {}),
    };

    // Evict oldest entries if cache is too large
    await this.evictIfNeeded(persistentCache);

    // Save back to storage
    await this.savePersistentCache(persistentCache);
  }

  /**
   * Clears all caches (both memory and persistent)
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.persistentCacheSize = 0;
    await setLocalStorage({ tweetToxicityCache: {} });
  }

  /**
   * Returns the current size of the persistent cache in bytes
   */
  getPersistentCacheSize(): number {
    return this.persistentCacheSize;
  }

  /**
   * Returns the number of entries in the memory cache
   */
  getMemoryCacheSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Loads the persistent cache from chrome.storage.local
   * Validates the structure and updates internal size tracking
   */
  private async loadPersistentCache(): Promise<PersistentCache> {
    const result = await getLocalStorage('tweetToxicityCache');
    const cache = result.tweetToxicityCache || {};

    // Validate cache structure
    const parseResult = PersistentCacheSchema.safeParse(cache);
    if (!parseResult.success) {
      console.warn('Invalid cache structure in storage, resetting cache');
      return {};
    }

    // Update size tracking
    this.persistentCacheSize = JSON.stringify(parseResult.data).length;

    return parseResult.data;
  }

  /**
   * Saves the persistent cache to chrome.storage.local
   */
  private async savePersistentCache(cache: PersistentCache): Promise<void> {
    const serialized = JSON.stringify(cache);
    this.persistentCacheSize = serialized.length;

    try {
      await setLocalStorage({ tweetToxicityCache: cache });
    } catch (error) {
      throw new CacheError(
        `Failed to save cache to storage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Evicts oldest entries from cache if size exceeds limit
   * Uses FIFO based on timestamp
   */
  private async evictIfNeeded(cache: PersistentCache): Promise<void> {
    // Calculate current size efficiently
    const currentSize = JSON.stringify(cache).length;

    if (currentSize <= this.maxPersistentCacheSize) {
      return;
    }

    // Sort entries by timestamp (oldest first)
    const sortedEntries = Object.entries(cache).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    // Remove oldest entries until we're under the limit
    let newCache: PersistentCache = { ...cache };
    let newSize = currentSize;

    for (const [hash] of sortedEntries) {
      if (newSize <= this.maxPersistentCacheSize) {
        break;
      }

      delete newCache[hash];
      newSize = JSON.stringify(newCache).length;
    }

    // Update the cache reference
    Object.keys(cache).forEach((key) => delete cache[key]);
    Object.assign(cache, newCache);

    this.persistentCacheSize = newSize;
  }
}

/**
 * Global singleton instance for convenience
 * Can be replaced with dependency injection in tests
 */
let globalCacheManager: CacheManager | null = null;

/**
 * Gets or creates the global CacheManager instance
 */
export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}

/**
 * Sets a custom CacheManager instance (useful for testing)
 */
export function setCacheManager(manager: CacheManager): void {
  globalCacheManager = manager;
}
