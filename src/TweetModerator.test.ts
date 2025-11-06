import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TweetModerator } from './TweetModerator';
import { OpenAIClient } from './OpenAIClient';
import { CacheManager } from './CacheManager';
import { keywords } from './lib';

// Mock getTweetPrefix
vi.mock('./lib', async () => {
  const actual = await vi.importActual('./lib');
  return {
    ...actual,
    getTweetPrefix: vi.fn(async () => 'Test prefix: '),
  };
});

describe('TweetModerator', () => {
  let mockOpenAIClient: OpenAIClient;
  let mockCacheManager: CacheManager;
  let moderator: TweetModerator;

  beforeEach(() => {
    // Create mock OpenAI client
    mockOpenAIClient = {
      simpleChat: vi.fn(),
    } as any;

    // Create mock cache manager
    mockCacheManager = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
    } as any;

    moderator = new TweetModerator(mockOpenAIClient, mockCacheManager);
  });

  describe('hashTweet', () => {
    it('should generate consistent hash for same tweet', async () => {
      const tweet = 'This is a test tweet';
      const hash1 = await moderator.hashTweet(tweet as any);
      const hash2 = await moderator.hashTweet(tweet as any);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different tweets', async () => {
      const tweet1 = 'First tweet';
      const tweet2 = 'Second tweet';

      const hash1 = await moderator.hashTweet(tweet1 as any);
      const hash2 = await moderator.hashTweet(tweet2 as any);

      expect(hash1).not.toBe(hash2);
    });

    it('should include first 50 chars in hash for debugging', async () => {
      const tweet = 'This is a test tweet with some content';
      const hash = await moderator.hashTweet(tweet as any);

      expect(hash).toContain(tweet.slice(0, 50));
    });
  });

  describe('isTweetToxic', () => {
    it('should return cached result when available', async () => {
      const tweetText = 'Cached toxic tweet';
      (mockCacheManager.get as any).mockResolvedValue(true);

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(true);
      expect(mockOpenAIClient.simpleChat).not.toHaveBeenCalled();
    });

    it('should classify tweet as toxic when response contains bad keyword', async () => {
      const tweetText = 'This tweet is inflammatory';
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        `Analysis of the tweet... ${keywords.bad}`
      );

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledWith(expect.any(String), true);
    });

    it('should classify tweet as non-toxic when response contains good keyword', async () => {
      const tweetText = 'This is a nice tweet';
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        `Analysis of the tweet... ${keywords.good}`
      );

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(false);
      expect(mockCacheManager.set).toHaveBeenCalledWith(expect.any(String), false);
    });

    it('should return false when both good and bad keywords are present', async () => {
      const tweetText = 'Ambiguous tweet';
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        `Contains both: ${keywords.bad} and ${keywords.good}`
      );

      const result = await moderator.isTweetToxic(tweetText);

      // hasBad && !hasGood = true && !true = false
      expect(result).toBe(false);
    });

    it('should return false when neither keyword is present', async () => {
      const tweetText = 'Unclear response';
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        'This response has no classification keywords'
      );

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      const tweetText = 'Tweet causing API error';
      (mockOpenAIClient.simpleChat as any).mockRejectedValue(new Error('API Error'));

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(false);
      // Should not cache errors
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should return false for empty tweet text', async () => {
      const result = await moderator.isTweetToxic('');

      expect(result).toBe(false);
      expect(mockOpenAIClient.simpleChat).not.toHaveBeenCalled();
    });

    it('should call OpenAI with correct model', async () => {
      const tweetText = 'Test tweet';
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        `Response ${keywords.good}`
      );

      await moderator.isTweetToxic(tweetText);

      expect(mockOpenAIClient.simpleChat).toHaveBeenCalledWith(
        expect.stringContaining(tweetText),
        'gpt-4o'
      );
    });
  });

  describe('processTweet', () => {
    it('should hide toxic tweet by removing parent article', async () => {
      const mockTweetNode = {
        innerText: 'Toxic tweet content',
        parentElement: {
          tagName: 'DIV',
          parentElement: {
            tagName: 'ARTICLE',
            remove: vi.fn(),
          },
        },
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        `Toxic ${keywords.bad}`
      );

      await moderator.processTweet(mockTweetNode);

      expect(mockTweetNode.parentElement.parentElement.remove).toHaveBeenCalled();
    });

    it('should not hide non-toxic tweet', async () => {
      const mockTweetNode = {
        innerText: 'Nice tweet content',
        parentElement: {
          tagName: 'DIV',
          parentElement: {
            tagName: 'ARTICLE',
            remove: vi.fn(),
          },
        },
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockOpenAIClient.simpleChat as any).mockResolvedValue(
        `Not toxic ${keywords.good}`
      );

      await moderator.processTweet(mockTweetNode);

      expect(mockTweetNode.parentElement.parentElement.remove).not.toHaveBeenCalled();
    });

    it('should not process same tweet twice', async () => {
      const mockTweetNode = {
        innerText: 'Test tweet',
      } as any;

      await moderator.processTweet(mockTweetNode);
      await moderator.processTweet(mockTweetNode);

      // Should only call isTweetToxic once
      expect(mockCacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should handle missing parent article gracefully', async () => {
      const mockTweetNode = {
        innerText: 'Toxic tweet',
        parentElement: null,
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(true);

      // Should not throw error
      await expect(moderator.processTweet(mockTweetNode)).resolves.not.toThrow();
    });
  });

  // Skipping DOM-related tests since we're not mocking the DOM environment
  // isTweetNode and findTweetNodes would need DOM mocking

  describe('resetProcessedTweets', () => {
    it('should allow reprocessing tweets after reset', async () => {
      const mockTweetNode = {
        innerText: 'Test tweet',
      } as any;

      await moderator.processTweet(mockTweetNode);

      // Reset and process again
      moderator.resetProcessedTweets();
      await moderator.processTweet(mockTweetNode);

      // Should call cache twice (once before reset, once after)
      expect(mockCacheManager.get).toHaveBeenCalledTimes(2);
    });
  });
});
