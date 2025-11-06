import { CacheManager, getCacheManager } from './CacheManager';
import { getTweetPrefix, keywords, maxKeywordLength } from './lib';
import { OpenAIClient } from './OpenAIClient';
import { OpenAIError, Tweet, TweetHash, TweetHashSchema, TweetSchema } from './types';

/**
 * Main class for moderating tweets using OpenAI API
 * Handles tweet classification, caching, and DOM manipulation
 */
export class TweetModerator {
  private readonly openAIClient: OpenAIClient;
  private readonly cacheManager: CacheManager;
  private readonly processedTweets = new Set<HTMLElement>();

  constructor(openAIClient: OpenAIClient, cacheManager?: CacheManager) {
    this.openAIClient = openAIClient;
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
   * Checks if a tweet is toxic using OpenAI API
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
      const prefix = await getTweetPrefix();
      const responseText = await this.openAIClient.simpleChat(prefix + text, 'gpt-4o');

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
      if (error instanceof OpenAIError) {
        console.error('OpenAI API error:', error.message, error.statusCode);
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
   * @param tweetNode - The DOM element containing the tweet text
   */
  async processTweet(tweetNode: HTMLElement): Promise<void> {
    // Prevent processing the same tweet multiple times concurrently
    if (this.processedTweets.has(tweetNode)) {
      return;
    }
    this.processedTweets.add(tweetNode);

    const text = tweetNode.innerText;
    if (!text) {
      return;
    }

    try {
      const isToxic = await this.isTweetToxic(text);
      if (isToxic) {
        const parentArticle = this.getParentArticle(tweetNode);
        if (parentArticle) {
          console.log('Hiding toxic tweet:', text);
          // Hide by removing from DOM rather than setting display:none
          // This is more effective for Twitter's layout engine
          parentArticle.remove();
        }
      }
    } catch (error) {
      console.error('Error processing tweet:', error);
      // Remove from processed set so it can be retried
      this.processedTweets.delete(tweetNode);
    }
  }

  /**
   * Finds the parent <article> element containing a tweet
   * Twitter/X wraps each tweet in an article tag
   */
  private getParentArticle(node: HTMLElement): HTMLElement | null {
    let parent: HTMLElement | null = node;
    while (parent && parent.tagName !== 'ARTICLE') {
      parent = parent.parentElement;
    }
    return parent;
  }

  /**
   * Checks if a DOM element is a tweet text node
   */
  static isTweetNode(node: Element): boolean {
    return (
      node.getAttribute('data-testid') === 'tweetText' && node instanceof HTMLElement
    );
  }

  /**
   * Finds all tweet nodes on the page that match Twitter's structure
   * Uses the class name that Twitter applies to tweet text containers
   */
  static findTweetNodes(): HTMLElement[] {
    // Twitter's internal class for tweet text containers
    const tweetClass = 'r-8akbws';
    const elements = Array.from(document.getElementsByClassName(tweetClass));

    return elements.filter((el): el is HTMLElement => TweetModerator.isTweetNode(el));
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
 * Creates a TweetModerator instance with an OpenAI client
 */
export function createTweetModerator(
  openAIClient: OpenAIClient,
  cacheManager?: CacheManager
): TweetModerator {
  return new TweetModerator(openAIClient, cacheManager);
}
