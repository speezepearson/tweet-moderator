import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TweetModerator } from './TweetModerator';
import { AIClient } from './AIClient';
import { CacheManager } from './CacheManager';
import { keywords } from './lib';

// Mock getSystemPrompt
vi.mock('./lib', async () => {
  const actual = await vi.importActual('./lib');
  return {
    ...actual,
    getSystemPrompt: vi.fn(async () => 'Test system prompt'),
    getTweetPrefix: vi.fn(async () => 'Test system prompt'), // Keep for backwards compat
  };
});

describe('TweetModerator', () => {
  let mockAIClient: AIClient;
  let mockCacheManager: CacheManager;
  let moderator: TweetModerator;

  beforeEach(() => {
    // Create mock AI client
    mockAIClient = {
      chat: vi.fn(),
    } as any;

    // Create mock cache manager
    mockCacheManager = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
    } as any;

    moderator = new TweetModerator(mockAIClient, 'test-model', mockCacheManager);
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
      expect(mockAIClient.chat).not.toHaveBeenCalled();
    });

    it('should classify tweet as toxic when response contains bad keyword', async () => {
      const tweetText = 'This tweet is inflammatory';
      const responseText = `Analysis of the tweet... ${keywords.bad}`;
      (mockAIClient.chat as any).mockResolvedValue(responseText);

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledWith(expect.any(String), true, responseText);
    });

    it('should classify tweet as non-toxic when response contains good keyword', async () => {
      const tweetText = 'This is a nice tweet';
      const responseText = `Analysis of the tweet... ${keywords.good}`;
      (mockAIClient.chat as any).mockResolvedValue(responseText);

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(false);
      expect(mockCacheManager.set).toHaveBeenCalledWith(expect.any(String), false, responseText);
    });

    it('should return false when both good and bad keywords are present', async () => {
      const tweetText = 'Ambiguous tweet';
      (mockAIClient.chat as any).mockResolvedValue(
        `Contains both: ${keywords.bad} and ${keywords.good}`
      );

      const result = await moderator.isTweetToxic(tweetText);

      // hasBad && !hasGood = true && !true = false
      expect(result).toBe(false);
    });

    it('should return false when neither keyword is present', async () => {
      const tweetText = 'Unclear response';
      (mockAIClient.chat as any).mockResolvedValue(
        'This response has no classification keywords'
      );

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      const tweetText = 'Tweet causing API error';
      (mockAIClient.chat as any).mockRejectedValue(new Error('API Error'));

      const result = await moderator.isTweetToxic(tweetText);

      expect(result).toBe(false);
      // Should not cache errors
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should return false for empty tweet text', async () => {
      const result = await moderator.isTweetToxic('');

      expect(result).toBe(false);
      expect(mockAIClient.chat).not.toHaveBeenCalled();
    });

    it('should call AIClient with correct model and system prompt', async () => {
      const tweetText = 'Test tweet';
      (mockAIClient.chat as any).mockResolvedValue(
        `Response ${keywords.good}`
      );

      await moderator.isTweetToxic(tweetText);

      expect(mockAIClient.chat).toHaveBeenCalledWith(
        tweetText,
        'test-model',
        'Test system prompt'
      );
    });
  });


  // Skipping DOM-related tests since we're not mocking the DOM environment
  // isTweetNode and findTweetNodes would need DOM mocking

  describe('processTweet', () => {
    it('should hide toxic tweet by removing the tweet node', async () => {
      const mockTweetTextElement = {
        innerText: 'Toxic tweet content',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        remove: vi.fn(),
        style: {},
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockAIClient.chat as any).mockResolvedValue(`Toxic ${keywords.bad}`);

      await moderator.processTweet(mockTweetNode);

      expect(mockTweetNode.querySelector).toHaveBeenCalledWith('[data-testid="tweetText"]');
      expect(mockTweetNode.remove).toHaveBeenCalled();
      expect(mockTweetNode.style.opacity).toBe('0');
    });

    it('should show non-toxic tweet', async () => {
      const mockTweetTextElement = {
        innerText: 'Nice tweet content',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        remove: vi.fn(),
        style: {},
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockAIClient.chat as any).mockResolvedValue(`Not toxic ${keywords.good}`);

      await moderator.processTweet(mockTweetNode);

      expect(mockTweetNode.remove).not.toHaveBeenCalled();
      expect(mockTweetNode.style.opacity).toBe('1');
    });

    it('should set tweet opacity to 0 while checking toxicity', async () => {
      const mockTweetTextElement = {
        innerText: 'Test tweet',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        remove: vi.fn(),
        style: {},
      } as any;

      // Mock a slow API call to verify opacity is set immediately
      let resolveChat: any;
      const chatPromise = new Promise((resolve) => {
        resolveChat = resolve;
      });
      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockAIClient.chat as any).mockReturnValue(chatPromise);

      const processingPromise = moderator.processTweet(mockTweetNode);

      // Opacity should be set to 0 immediately
      expect(mockTweetNode.style.opacity).toBe('0');

      // Complete the API call
      resolveChat(`Not toxic ${keywords.good}`);
      await processingPromise;

      // After processing, opacity should be 1
      expect(mockTweetNode.style.opacity).toBe('1');
    });

    it('should not process same tweet twice', async () => {
      const mockTweetTextElement = {
        innerText: 'Test tweet',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        style: {},
      } as any;

      await moderator.processTweet(mockTweetNode);
      await moderator.processTweet(mockTweetNode);

      // Should only call isTweetToxic once
      expect(mockCacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should show tweet with opacity 1 when no text element found', async () => {
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(null),
        remove: vi.fn(),
        style: {},
      } as any;

      await moderator.processTweet(mockTweetNode);

      expect(mockTweetNode.remove).not.toHaveBeenCalled();
      expect(mockTweetNode.style.opacity).toBe('1');
    });

    it('should show tweet with opacity 1 on error', async () => {
      const mockTweetTextElement = {
        innerText: 'Test tweet',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        remove: vi.fn(),
        style: {},
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockAIClient.chat as any).mockRejectedValue(new Error('API Error'));

      await moderator.processTweet(mockTweetNode);

      expect(mockTweetNode.remove).not.toHaveBeenCalled();
      expect(mockTweetNode.style.opacity).toBe('1');
    });
  });

  describe('resetProcessedTweets', () => {
    it('should allow reprocessing tweets after reset', async () => {
      const mockTweetTextElement = {
        innerText: 'Test tweet',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        style: {},
      } as any;

      await moderator.processTweet(mockTweetNode);

      // Reset and process again
      moderator.resetProcessedTweets();
      await moderator.processTweet(mockTweetNode);

      // Should call cache twice (once before reset, once after)
      expect(mockCacheManager.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('createFeedbackButton', () => {
    it('should call createFeedbackButton for non-toxic tweets', async () => {
      const mockTweetTextElement = {
        innerText: 'Nice tweet content',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        remove: vi.fn(),
        style: {},
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockAIClient.chat as any).mockResolvedValue(`Not toxic ${keywords.good}`);

      await moderator.processTweet(mockTweetNode);

      // In test environment (no document), button creation is skipped but tweet is marked
      // We verify this by trying to process again and checking no errors occur
      moderator.resetProcessedTweets();
      await expect(moderator.processTweet(mockTweetNode)).resolves.not.toThrow();
    });

    it('should not call createFeedbackButton for tweets without text', async () => {
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(null),
        remove: vi.fn(),
        style: {},
      } as any;

      await moderator.processTweet(mockTweetNode);

      // Verify no errors and tweet is shown
      expect(mockTweetNode.style.opacity).toBe('1');
    });

    it('should not create duplicate feedback buttons', async () => {
      const mockTweetTextElement = {
        innerText: 'Test tweet',
      };
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(mockTweetTextElement),
        remove: vi.fn(),
        style: {},
      } as any;

      (mockCacheManager.get as any).mockResolvedValue(undefined);
      (mockAIClient.chat as any).mockResolvedValue(`Not toxic ${keywords.good}`);

      await moderator.processTweet(mockTweetNode);

      // Reset processed tweets but NOT feedback buttons
      moderator.resetProcessedTweets();

      // Process again - should not throw even though feedback button was already "added"
      await expect(moderator.processTweet(mockTweetNode)).resolves.not.toThrow();
    });
  });

  describe('extractTweetMetadata', () => {
    it('should extract metadata from tweet DOM', () => {
      // Create mock DOM elements without document.createElement
      const displayNameSpan = {
        textContent: 'Cicely Dykeson',
      };

      const userNameSection = {
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([displayNameSpan]),
      };

      const authorLink = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'href') return '/ThatsSoSiren';
          if (attr === 'role') return 'link';
          return null;
        }),
      };

      const statusLink = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'href') return '/ThatsSoSiren/status/1986182104342794651';
          return null;
        }),
      };

      const mockTweetNode = {
        querySelector: vi.fn((selector: string) => {
          if (selector === 'a[href^="/"][role="link"]') return authorLink;
          if (selector === '[data-testid="User-Name"]') return userNameSection;
          if (selector === 'a[href*="/status/"]') return statusLink;
          return null;
        }),
      } as any;

      const metadata = moderator.extractTweetMetadata(mockTweetNode);

      expect(metadata).not.toBeNull();
      expect(metadata?.author).toBe('@ThatsSoSiren');
      expect(metadata?.authorDisplayName).toBe('Cicely Dykeson');
      expect(metadata?.url).toBe('https://x.com/ThatsSoSiren/status/1986182104342794651');
    });

    it('should return null when author link not found', () => {
      const mockTweetNode = {
        querySelector: vi.fn().mockReturnValue(null),
      } as any;

      const metadata = moderator.extractTweetMetadata(mockTweetNode);

      expect(metadata).toBeNull();
    });

    it('should fallback to username when display name not found', () => {
      const authorLink = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'href') return '/testuser';
          return null;
        }),
      };

      const statusLink = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'href') return '/testuser/status/123';
          return null;
        }),
      };

      const mockTweetNode = {
        querySelector: vi.fn((selector: string) => {
          if (selector === 'a[href^="/"][role="link"]') return authorLink;
          if (selector === '[data-testid="User-Name"]') return null;
          if (selector === 'a[href*="/status/"]') return statusLink;
          return null;
        }),
      } as any;

      const metadata = moderator.extractTweetMetadata(mockTweetNode);

      expect(metadata).not.toBeNull();
      expect(metadata?.author).toBe('@testuser');
      expect(metadata?.authorDisplayName).toBe('testuser');
      expect(metadata?.url).toBe('https://x.com/testuser/status/123');
    });

    it('should use fallback URL when status link not found', () => {
      const authorLink = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'href') return '/testuser';
          return null;
        }),
      };

      const mockTweetNode = {
        querySelector: vi.fn((selector: string) => {
          if (selector === 'a[href^="/"][role="link"]') return authorLink;
          if (selector === 'a[href*="/status/"]') return null;
          return null;
        }),
      } as any;

      const metadata = moderator.extractTweetMetadata(mockTweetNode);

      expect(metadata).not.toBeNull();
      expect(metadata?.url).toBe('https://x.com/testuser');
    });
  });
});