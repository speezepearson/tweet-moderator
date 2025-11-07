import { AIClient } from './AIClient';
import { CacheManager, getCacheManager } from './CacheManager';
import { getFeedbackModal } from './FeedbackModal';
import { getSystemPrompt, keywords, maxKeywordLength } from './lib';
import {
  AnthropicError,
  Tweet,
  TweetHash,
  TweetHashSchema,
  TweetMetadata,
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
  private readonly tweetsWithFeedback = new WeakSet<HTMLElement>();

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
   * Extracts metadata from a tweet DOM node
   * Extracts URL, author username, and display name
   *
   * @param tweetNode - The tweet article element
   * @returns Tweet metadata or null if extraction fails
   */
  extractTweetMetadata(tweetNode: HTMLElement): TweetMetadata | null {
    try {
      // Extract author username from href="/username" links
      const authorLink = tweetNode.querySelector('a[href^="/"][role="link"]') as HTMLAnchorElement | null;
      if (!authorLink) {
        return null;
      }

      const authorHref = authorLink.getAttribute('href');
      if (!authorHref) {
        return null;
      }

      // Extract @username from href (format: "/username" or "/username/status/...")
      const author = authorHref.split('/')[1];
      if (!author) {
        return null;
      }

      // Extract display name from User-Name section
      const userNameSection = tweetNode.querySelector('[data-testid="User-Name"]');
      let authorDisplayName = author; // Fallback to username

      if (userNameSection) {
        // Find the display name span (first one without @ symbol)
        const nameSpans = Array.from(userNameSection.querySelectorAll('span'));
        for (const span of nameSpans) {
          const text = span.textContent?.trim();
          if (text && !text.startsWith('@') && text !== '·' && !text.match(/^\w{3}\s\d+$/)) {
            authorDisplayName = text;
            break;
          }
        }
      }

      // Extract tweet URL from status link
      const statusLink = tweetNode.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
      let url = `https://x.com/${author}`; // Fallback URL

      if (statusLink) {
        const statusHref = statusLink.getAttribute('href');
        if (statusHref) {
          // Extract status ID from href (format: "/username/status/1234567890")
          const statusMatch = statusHref.match(/\/status\/(\d+)/);
          if (statusMatch) {
            url = `https://x.com${statusHref}`;
          }
        }
      }

      return {
        url,
        author: `@${author}`,
        authorDisplayName,
      };
    } catch (error) {
      console.warn('Failed to extract tweet metadata:', error);
      return null;
    }
  }

  /**
   * Checks if a tweet is toxic using AI API
   * Results are cached for performance
   *
   * @param text - The tweet text to check
   * @returns true if toxic, false otherwise
   */
  async isTweetToxic(text: string): Promise<boolean> {
    if (text.includes('Unfortunately your impression is mistaken')) {
      await new Promise(r => setTimeout(()=>r(null), 5000));
      return false;
    }
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

      // Cache result with full reasoning
      await this.cacheManager.set(hash, isToxic, responseText);

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
   * Creates and injects a feedback button into a tweet node
   * Button allows users to provide feedback on AI classification
   *
   * @param tweetNode - The tweet article element
   * @param tweetText - The tweet text content
   * @param isToxic - Whether the tweet was classified as toxic
   */
  private createFeedbackButton(tweetNode: HTMLElement, tweetText: string, isToxic: boolean): void {
    // Don't add button if already added
    if (this.tweetsWithFeedback.has(tweetNode)) {
      return;
    }

    // Skip in test environment where document is not available
    if (typeof document === 'undefined') {
      this.tweetsWithFeedback.add(tweetNode);
      return;
    }

    // Create feedback button
    const button = document.createElement('button');
    button.setAttribute('data-testid', 'ai-feedback-button');
    button.setAttribute('aria-label', 'Provide AI feedback');
    button.textContent = 'AI Feedback';

    // Style to match Twitter's subtle action buttons
    Object.assign(button.style, {
      position: 'absolute',
      top: '12px',
      right: '12px',
      backgroundColor: 'transparent',
      border: '1px solid rgb(207, 217, 222)',
      borderRadius: '9999px',
      padding: '4px 12px',
      fontSize: '13px',
      fontWeight: '700',
      color: 'rgb(83, 100, 113)',
      cursor: 'pointer',
      opacity: '0',
      transition: 'opacity 0.2s, background-color 0.2s',
      zIndex: '10',
    });

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
      button.style.borderColor = 'rgb(29, 155, 240)';
      button.style.color = 'rgb(29, 155, 240)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
      button.style.borderColor = 'rgb(207, 217, 222)';
      button.style.color = 'rgb(83, 100, 113)';
    });

    // Click handler - opens feedback modal
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Get tweet metadata
      const metadata = this.extractTweetMetadata(tweetNode);
      if (!metadata) {
        console.error('Failed to extract tweet metadata for feedback');
        return;
      }

      // Get tweet hash
      const tweet = TweetSchema.parse(tweetText);
      const hash = await this.hashTweet(tweet);

      // Open feedback modal
      const feedbackModal = getFeedbackModal();
      await feedbackModal.open(tweetText, hash, isToxic, metadata);
    });

    // Show button on tweet hover
    tweetNode.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
    });

    tweetNode.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
    });

    // Make tweet position relative so button can be absolutely positioned
    if (tweetNode.style.position !== 'relative' && tweetNode.style.position !== 'absolute') {
      tweetNode.style.position = 'relative';
    }

    // Inject button into tweet
    tweetNode.appendChild(button);
    this.tweetsWithFeedback.add(tweetNode);
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

    // Hide tweet immediately while checking toxicity
    tweetNode.style.opacity = '0';

    // Extract text from the tweetText element within the article
    const tweetTextElement = tweetNode.querySelector(
      '[data-testid="tweetText"]'
    ) as HTMLElement | null;
    const text = tweetTextElement?.innerText;
    if (!text) {
      // No text to moderate, show the tweet
      tweetNode.style.opacity = '1';
      return;
    }

    try {
      const isToxic = await this.isTweetToxic(text);
      if (isToxic) {
        console.log('Hiding toxic tweet:', text);
        // Remove the tweet article directly
        tweetNode.remove();
      } else {
        // Safe tweet, fade it in
        tweetNode.style.opacity = '1';
        // Add feedback button for non-toxic tweets
        this.createFeedbackButton(tweetNode, text, isToxic);
      }
    } catch (error) {
      console.error('Error processing tweet:', error);
      // On error, show the tweet rather than hiding it
      tweetNode.style.opacity = '1';
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
