import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedbackManager } from './FeedbackManager';
import { FeedbackEntry, TweetHashSchema } from './types';

describe('FeedbackManager', () => {
  let feedbackManager: FeedbackManager;
  let storage: Record<string, any>;

  beforeEach(() => {
    // Mock chrome.storage.local
    storage = {};
    (globalThis as any).chrome = {
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
        },
      },
    } as any;

    feedbackManager = new FeedbackManager();
  });

  describe('addFeedback', () => {
    it('should add a feedback entry to storage', async () => {
      const entry: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet1 abc123'),
        text: 'Test tweet',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now(),
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      await feedbackManager.addFeedback(entry);

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toHaveLength(1);
      expect(feedback[0]).toEqual(entry);
    });

    it('should add multiple feedback entries', async () => {
      const entry1: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet1 abc123'),
        text: 'Test tweet 1',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now(),
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      const entry2: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet2 def456'),
        text: 'Test tweet 2',
        url: 'https://x.com/user/status/456',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now() + 1000,
        aiSaidToxic: true,
        aiReasoning: 'This is toxic',
        userSaysToxic: false,
        userExplanation: 'Actually this is fine',
      };

      await feedbackManager.addFeedback(entry1);
      await feedbackManager.addFeedback(entry2);

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toHaveLength(2);
    });
  });

  describe('getAllFeedback', () => {
    it('should return empty array when no feedback exists', async () => {
      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toEqual([]);
    });

    it('should return all feedback entries', async () => {
      const entry1: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet1 abc123'),
        text: 'Test tweet 1',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now(),
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      const entry2: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet2 def456'),
        text: 'Test tweet 2',
        url: 'https://x.com/user/status/456',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now() + 1000,
        aiSaidToxic: true,
        aiReasoning: 'This is toxic',
        userSaysToxic: false,
        userExplanation: 'Actually this is fine',
      };

      await feedbackManager.addFeedback(entry1);
      await feedbackManager.addFeedback(entry2);

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toHaveLength(2);
      expect(feedback).toContainEqual(entry1);
      expect(feedback).toContainEqual(entry2);
    });
  });

  describe('deleteFeedback', () => {
    it('should delete a specific feedback entry', async () => {
      const hash1 = TweetHashSchema.parse('tweet1 abc123');
      const hash2 = TweetHashSchema.parse('tweet2 def456');

      const entry1: FeedbackEntry = {
        hash: hash1,
        text: 'Test tweet 1',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now(),
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      const entry2: FeedbackEntry = {
        hash: hash2,
        text: 'Test tweet 2',
        url: 'https://x.com/user/status/456',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now() + 1000,
        aiSaidToxic: true,
        aiReasoning: 'This is toxic',
        userSaysToxic: false,
        userExplanation: 'Actually this is fine',
      };

      await feedbackManager.addFeedback(entry1);
      await feedbackManager.addFeedback(entry2);

      await feedbackManager.deleteFeedback(hash1);

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toHaveLength(1);
      expect(feedback[0].hash).toBe(hash2);
    });

    it('should handle deleting non-existent entry', async () => {
      const hash = TweetHashSchema.parse('nonexistent abc123');
      await feedbackManager.deleteFeedback(hash);

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toEqual([]);
    });
  });

  describe('clearAllFeedback', () => {
    it('should clear all feedback entries', async () => {
      const entry: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet1 abc123'),
        text: 'Test tweet',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now(),
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      await feedbackManager.addFeedback(entry);
      await feedbackManager.clearAllFeedback();

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toEqual([]);
    });
  });

  describe('getFeedbackCount', () => {
    it('should return 0 when no feedback exists', async () => {
      const count = await feedbackManager.getFeedbackCount();
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      const entry1: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet1 abc123'),
        text: 'Test tweet 1',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now(),
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      const entry2: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet2 def456'),
        text: 'Test tweet 2',
        url: 'https://x.com/user/status/456',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: Date.now() + 1000,
        aiSaidToxic: true,
        aiReasoning: 'This is toxic',
        userSaysToxic: false,
        userExplanation: 'Actually this is fine',
      };

      await feedbackManager.addFeedback(entry1);
      await feedbackManager.addFeedback(entry2);

      const count = await feedbackManager.getFeedbackCount();
      expect(count).toBe(2);
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest entries when count exceeds limit', async () => {
      const smallFeedbackManager = new FeedbackManager(2); // Max 2 entries

      const entry1: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet1 abc123'),
        text: 'Test tweet 1',
        url: 'https://x.com/user/status/123',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: 1000,
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      const entry2: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet2 def456'),
        text: 'Test tweet 2',
        url: 'https://x.com/user/status/456',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: 2000,
        aiSaidToxic: true,
        aiReasoning: 'This is toxic',
        userSaysToxic: false,
        userExplanation: 'Actually this is fine',
      };

      const entry3: FeedbackEntry = {
        hash: TweetHashSchema.parse('tweet3 ghi789'),
        text: 'Test tweet 3',
        url: 'https://x.com/user/status/789',
        author: '@user',
        authorDisplayName: 'User Name',
        timestamp: 3000,
        aiSaidToxic: false,
        aiReasoning: 'This is fine',
        userSaysToxic: true,
        userExplanation: 'Actually this is toxic',
      };

      await smallFeedbackManager.addFeedback(entry1);
      await smallFeedbackManager.addFeedback(entry2);
      await smallFeedbackManager.addFeedback(entry3);

      const feedback = await smallFeedbackManager.getAllFeedback();
      expect(feedback).toHaveLength(2);
      // Should keep entry2 and entry3, evict entry1 (oldest)
      expect(feedback.map((e) => e.hash)).not.toContain(entry1.hash);
      expect(feedback.map((e) => e.hash)).toContain(entry2.hash);
      expect(feedback.map((e) => e.hash)).toContain(entry3.hash);
    });
  });

  describe('invalid storage handling', () => {
    it('should handle invalid storage structure gracefully', async () => {
      // Set invalid data
      storage.userFeedback = 'invalid data';

      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toEqual([]);
    });

    it('should handle missing storage gracefully', async () => {
      const feedback = await feedbackManager.getAllFeedback();
      expect(feedback).toEqual([]);
    });
  });
});
