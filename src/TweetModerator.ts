import { AIClient } from './AIClient';
import { CacheManager, getCacheManager } from './CacheManager';
import { getSystemPrompt, keywords, maxKeywordLength } from './lib';
import {
  AnthropicError,
  Tweet,
  TweetHash,
  TweetHashSchema,
  TweetSchema,
} from './types';

/**
 * Main class for moderating tweets using AI APIs (OpenAI, Anthropic, etc.)
 * Handles tweet classification, caching, and DOM manipulation
 */
export class TweetModerator {
  private readonly aiClient: AIClient;
  private readonly model: string;
  private readonly cacheManager: CacheManager;
  private readonly processedTweets = new Set<HTMLElement>();

  constructor(aiClient: AIClient, model: string, cacheManager?: CacheManager) {
    this.aiClient = aiClient;
    this.model = model;
    this.cacheManager = cacheManager || getCacheManager();
  }

  /**
   * Hashes a tweet for caching purposes
   * Uses SHA-256 and includes first 50 chars for debugging
   */
  async hashTweet(tweet: Tweet): Promise<TweetHash> {
    const encoder = new TextEncoder();
    const data = encoder.encode(tweet);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const hashWithPrefix = `${tweet.slice(0, 50)} ${hash}`;
    return TweetHashSchema.parse(hashWithPrefix);
  }

  /**
   * Checks if a tweet is toxic using AI API
   * Results are cached for performance
   *
   * @param text - The tweet text to check
   * @returns true if toxic, false otherwise
   */
  async isTweetToxic(text: string): Promise<boolean> {
    // Parse and validate tweet
    const parseResult = TweetSchema.safeParse(text);
    if (!parseResult.success) {
      console.warn('Invalid tweet text, skipping moderation');
      return false;
    }
    const tweet = parseResult.data;

    // Check cache
    const hash = await this.hashTweet(tweet);
    const cachedResult = await this.cacheManager.get(hash);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    // Make API call
    try {
      console.log('Checking tweet:', text);
      const systemPrompt = await getSystemPrompt();
      const responseText = await this.aiClient.chat(text, this.model, systemPrompt);

      // Parse classification from response
      const lastChars = responseText.slice(-(maxKeywordLength + 5));
      const hasGood = lastChars.includes(keywords.good);
      const hasBad = lastChars.includes(keywords.bad);
      const isToxic = hasBad && !hasGood;

      // Cache result
      await this.cacheManager.set(hash, isToxic);

      console.log({
        text,
        responseText,
        toxic: isToxic,
        slice: lastChars,
        bad: keywords.bad,
      });

      return isToxic;
    } catch (error) {
      if (error instanceof AnthropicError) {
        console.error('Anthropic API error:', error.message, error.statusCode);
        // Don't cache API errors, user might fix their API key
        return false;
      }
      console.error('Error moderating tweet:', error);
      return false;
    }
  }

  /**
   * Processes a tweet node, checking if it's toxic and hiding it if needed
   *
   * @param tweetNode - The DOM element containing the tweet (article with data-testid="tweet")
   */
  async processTweet(tweetNode: HTMLElement): Promise<void> {
    // Prevent processing the same tweet multiple times concurrently
    if (this.processedTweets.has(tweetNode)) {
      return;
    }
    this.processedTweets.add(tweetNode);

    // Extract text from the tweetText element within the article
    const tweetTextElement = tweetNode.querySelector(
      '[data-testid="tweetText"]'
    ) as HTMLElement | null;
    const text = tweetTextElement?.innerText;
    if (!text) {
      return;
    }

    try {
      const isToxic = await this.isTweetToxic(text);
      if (isToxic) {
        console.log('Hiding toxic tweet:', text);
        // Remove the tweet article directly
        tweetNode.remove();
      }
    } catch (error) {
      console.error('Error processing tweet:', error);
      // Remove from processed set so it can be retried
      this.processedTweets.delete(tweetNode);
    }
  }

  /**
  }

  /**
   * Checks if a DOM element is a tweet node
   */
  static isTweetNode(node: Element): boolean {
    return node.getAttribute('data-testid') === 'tweet' && node instanceof HTMLElement;
  }

  /**
   * Finds all tweet nodes on the page that match Twitter's structure
   */
  static findTweetNodes(): HTMLElement[] {
    const elements = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
    return elements.filter((el): el is HTMLElement => el instanceof HTMLElement);
  }

  /**
   * Processes all tweets currently visible on the page
   */
  async processAllTweets(): Promise<void> {
    const tweets = TweetModerator.findTweetNodes();
    await Promise.all(tweets.map((tweet) => this.processTweet(tweet)));
  }

  /**
   * Resets the processed tweets set
   * Useful for testing or when you want to reprocess tweets
   */
  resetProcessedTweets(): void {
    this.processedTweets.clear();
  }
}

/**
 * Creates a TweetModerator instance with an AI client
 */
export function createTweetModerator(
  aiClient: AIClient,
  model: string,
  cacheManager?: CacheManager
): TweetModerator {
  return new TweetModerator(aiClient, model, cacheManager);
}
