import { DEFAULT_MODELS } from './AIClient';
import { BackgroundAIClient } from './BackgroundAIClient';
import { getAIBackend } from './lib';
import { TweetModerator } from './TweetModerator';

/**
 * Main content script for the Tweet Moderator extension
 * Uses MutationObserver to detect new tweets and moderate them in real-time
 */

let moderator: TweetModerator | null = null;
let observer: MutationObserver | null = null;

/**
 * Initializes the tweet moderation system
 * Creates a BackgroundAIClient that proxies requests to the background script
 */
async function initialize(): Promise<void> {
  const backend = await getAIBackend();
  const model = DEFAULT_MODELS[backend];

  // Use BackgroundAIClient to avoid CORS issues
  // The background script will handle the actual API calls
  const aiClient = new BackgroundAIClient(model);

  try {
    moderator = new TweetModerator(aiClient, model);

    // Process tweets that are already on the page
    await moderator.processAllTweets();

    // Set up observer for new tweets
    startObserver();

    console.log(`Tweet Moderator: Initialized successfully with ${backend} backend`);
  } catch (error) {
    console.error('Tweet Moderator: Failed to initialize:', error);
  }
}

/**
 * Starts the MutationObserver to watch for new tweets
 * More efficient than polling with setInterval
 */
function startObserver(): void {
  if (!moderator) {
    console.error('Tweet Moderator: Cannot start observer without moderator instance');
    return;
  }

  observer = new MutationObserver((mutations) => {
    // Check if any mutations added tweet nodes
    const hasNewTweets = mutations.some((mutation) => {
      if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
        return false;
      }

      return Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof HTMLElement)) {
          return false;
        }

        // Check if the node itself is a tweet
        if (TweetModerator.isTweetNode(node)) {
          return true;
        }

        // Check if descendants contain tweets
        return node.querySelectorAll('[data-testid="tweet"]').length > 0;
      });
    });

    if (hasNewTweets && moderator) {
      // Process all tweets (moderator keeps track of already-processed ones)
      moderator.processAllTweets().catch((error) => {
        console.error('Tweet Moderator: Error processing tweets:', error);
      });
    }
  });

  // Observe the entire document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('Tweet Moderator: Observer started');
}

/**
 * Stops the MutationObserver
 */
function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log('Tweet Moderator: Observer stopped');
  }
}

/**
 * Cleans up resources when the script is unloaded
 */
function cleanup(): void {
  stopObserver();
  moderator = null;
}

// Initialize when the script loads
initialize().catch((error) => {
  console.error('Tweet Moderator: Initialization failed:', error);
});

// Clean up when the page unloads
window.addEventListener('unload', cleanup);

// Listen for storage changes to reinitialize if settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === 'sync' &&
    (changes.openaiApiKey || changes.anthropicApiKey || changes.aiBackend)
  ) {
    console.log('Tweet Moderator: Settings changed, reinitializing...');
    cleanup();
    initialize().catch((error) => {
      console.error('Tweet Moderator: Reinitialization failed:', error);
    });
  }
});
