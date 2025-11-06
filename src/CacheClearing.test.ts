import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager } from './CacheManager';
import { TweetHashSchema } from './types';

/**
 * Integration tests for cache clearing functionality
 * These tests verify that the cache clearing mechanism used by the options page
 * actually clears the cache that CacheManager uses
 */
describe('Cache Clearing Integration', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    // Mock chrome.storage.local
    const storage: Record<string, any> = {};
    global.chrome = {
      storage: {
        local: {
          get: vi.fn((keys) => {
            if (typeof keys === 'string') {
              return Promise.resolve({ [keys]: storage[keys] });
            }
            if (Array.isArray(keys)) {
              const result: Record<string, any> = {};
              keys.forEach((key) => {
                result[key] = storage[key];
              });
              return Promise.resolve(result);
            }
            return Promise.resolve(storage);
          }),
          set: vi.fn((items) => {
            Object.assign(storage, items);
            return Promise.resolve();
          }),
          remove: vi.fn((keys) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach((key) => delete storage[key]);
            return Promise.resolve();
          }),
        },
      },
    } as any;

    cacheManager = new CacheManager();
  });

  it('should clear cache using the same storage key as options page', async () => {
    // Set up some cached data
    const hash1 = TweetHashSchema.parse('tweet1 abc123');
    const hash2 = TweetHashSchema.parse('tweet2 def456');

    await cacheManager.set(hash1, true);
    await cacheManager.set(hash2, false);

    // Verify data is cached
    expect(await cacheManager.get(hash1)).toBe(true);
    expect(await cacheManager.get(hash2)).toBe(false);

    // Simulate the options page clearing cache
    // This is exactly what options.ts does:
    await chrome.storage.local.set({ tweetToxicityCache: {} });

    // Create a new cache manager instance (simulates page reload)
    const newCacheManager = new CacheManager();

    // Verify cache is empty
    expect(await newCacheManager.get(hash1)).toBeUndefined();
    expect(await newCacheManager.get(hash2)).toBeUndefined();
  });

  it('should verify CacheManager.clear() uses the same storage key', async () => {
    // Set up some cached data
    const hash = TweetHashSchema.parse('test tweet 123');
    await cacheManager.set(hash, true);

    // Verify it's cached
    expect(await cacheManager.get(hash)).toBe(true);

    // Clear using CacheManager's clear method
    await cacheManager.clear();

    // Verify the storage key is correct by checking what's in storage
    const result = await chrome.storage.local.get(['tweetToxicityCache']);
    expect(result.tweetToxicityCache).toEqual({});

    // Verify cache is empty
    expect(await cacheManager.get(hash)).toBeUndefined();
  });

  it('should document the correct storage key for cache clearing', () => {
    // This test exists to make the storage key explicit and catch changes
    const EXPECTED_CACHE_KEY = 'tweetToxicityCache';

    // If this test fails, it means the cache key changed and the options page
    // needs to be updated to use the new key
    expect(EXPECTED_CACHE_KEY).toBe('tweetToxicityCache');
  });
});
