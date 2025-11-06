import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager } from './CacheManager';
import { TweetHashSchema } from './types';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result: Record<string, unknown> = {};
        if (Array.isArray(keys)) {
          keys.forEach((key) => {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          });
        } else if (typeof keys === 'string') {
          if (keys in mockStorage) {
            result[keys] = mockStorage[keys];
          }
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
    },
  },
} as any;

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    cacheManager = new CacheManager();
  });

  describe('get and set', () => {
    it('should return undefined for non-existent cache entry', async () => {
      const hash = TweetHashSchema.parse('test hash abc123');
      const result = await cacheManager.get(hash);
      expect(result).toBeUndefined();
    });

    it('should store and retrieve a toxic result', async () => {
      const hash = TweetHashSchema.parse('test tweet abc123');
      await cacheManager.set(hash, true);

      const result = await cacheManager.get(hash);
      expect(result).toBe(true);
    });

    it('should store and retrieve a non-toxic result', async () => {
      const hash = TweetHashSchema.parse('test tweet def456');
      await cacheManager.set(hash, false);

      const result = await cacheManager.get(hash);
      expect(result).toBe(false);
    });

    it('should warm up memory cache when retrieving from persistent cache', async () => {
      const hash = TweetHashSchema.parse('test tweet ghi789');
      await cacheManager.set(hash, true);

      // Create new cache manager to simulate fresh session
      const newCacheManager = new CacheManager();

      // First get should load from persistent storage
      const result1 = await newCacheManager.get(hash);
      expect(result1).toBe(true);

      // Memory cache should now be warmed up
      expect(newCacheManager.getMemoryCacheSize()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear both memory and persistent caches', async () => {
      const hash1 = TweetHashSchema.parse('tweet 1 abc123');
      const hash2 = TweetHashSchema.parse('tweet 2 def456');

      await cacheManager.set(hash1, true);
      await cacheManager.set(hash2, false);

      expect(cacheManager.getMemoryCacheSize()).toBe(2);
      expect(cacheManager.getPersistentCacheSize()).toBeGreaterThan(0);

      await cacheManager.clear();

      expect(cacheManager.getMemoryCacheSize()).toBe(0);
      expect(cacheManager.getPersistentCacheSize()).toBe(0);
    });
  });

  describe('eviction', () => {
    it('should evict entries when cache exceeds size limit', async () => {
      // Create cache manager with very small size limit
      const smallCacheManager = new CacheManager(150);

      // Add multiple entries that will exceed the limit
      const hash1 = TweetHashSchema.parse('x1');
      const hash2 = TweetHashSchema.parse('y2');
      const hash3 = TweetHashSchema.parse('z3');
      const hash4 = TweetHashSchema.parse('w4');
      const hash5 = TweetHashSchema.parse('v5');

      await smallCacheManager.set(hash1, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await smallCacheManager.set(hash2, false);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await smallCacheManager.set(hash3, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await smallCacheManager.set(hash4, false);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await smallCacheManager.set(hash5, true);

      // Cache size should be at or below limit after eviction
      expect(smallCacheManager.getPersistentCacheSize()).toBeLessThanOrEqual(150);

      // Create fresh cache manager to check persistent storage
      const freshCacheManager = new CacheManager(150);

      // At least one entry should have been evicted
      const allHashes = [hash1, hash2, hash3, hash4, hash5];
      const results = await Promise.all(allHashes.map(h => freshCacheManager.get(h)));
      const undefinedCount = results.filter(r => r === undefined).length;

      // Expect at least one entry was evicted
      expect(undefinedCount).toBeGreaterThan(0);
    });

    it('should maintain cache size below limit', async () => {
      const maxSize = 200;
      const smallCacheManager = new CacheManager(maxSize);

      // Add multiple entries
      for (let i = 0; i < 10; i++) {
        const hash = TweetHashSchema.parse(`tweet number ${i} with text hash${i}`);
        await smallCacheManager.set(hash, i % 2 === 0);
      }

      // Cache size should be at or below limit
      expect(smallCacheManager.getPersistentCacheSize()).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('size tracking', () => {
    it('should track persistent cache size accurately', async () => {
      const hash = TweetHashSchema.parse('test tweet abc123');
      await cacheManager.set(hash, true);

      const size = cacheManager.getPersistentCacheSize();
      expect(size).toBeGreaterThan(0);
    });

    it('should track memory cache size accurately', async () => {
      expect(cacheManager.getMemoryCacheSize()).toBe(0);

      const hash1 = TweetHashSchema.parse('tweet 1 abc123');
      const hash2 = TweetHashSchema.parse('tweet 2 def456');

      await cacheManager.set(hash1, true);
      expect(cacheManager.getMemoryCacheSize()).toBe(1);

      await cacheManager.set(hash2, false);
      expect(cacheManager.getMemoryCacheSize()).toBe(2);
    });
  });

  describe('validation', () => {
    it('should handle invalid cache structure gracefully', async () => {
      // Manually set invalid cache structure
      mockStorage.tweetToxicityCache = 'invalid structure';

      const hash = TweetHashSchema.parse('test tweet abc123');
      const result = await cacheManager.get(hash);

      // Should return undefined for invalid cache
      expect(result).toBeUndefined();
    });

    it('should reset cache when encountering invalid structure', async () => {
      // Set valid entry first
      const hash1 = TweetHashSchema.parse('valid tweet abc123');
      await cacheManager.set(hash1, true);

      // Corrupt the cache
      mockStorage.tweetToxicityCache = 'corrupted';

      // Create new cache manager
      const newCacheManager = new CacheManager();

      // Try to get the entry
      const result = await newCacheManager.get(hash1);
      expect(result).toBeUndefined();

      // Should be able to set new entries
      const hash2 = TweetHashSchema.parse('new tweet def456');
      await newCacheManager.set(hash2, false);

      const result2 = await newCacheManager.get(hash2);
      expect(result2).toBe(false);
    });
  });
});
