import { getOpenaiApiKey } from './lib';
import { OpenAIClient } from './OpenAIClient';
import { TweetModerator } from './TweetModerator';

/**
 * Main content script for the Tweet Moderator extension
 * Uses MutationObserver to detect new tweets and moderate them in real-time
 */

let moderator: TweetModerator | null = null;
let observer: MutationObserver | null = null;

/**
 * Initializes the tweet moderation system
 * Creates OpenAI client and TweetModerator instances
 */
async function initialize(): Promise<void> {
  const apiKey = await getOpenaiApiKey();
  if (!apiKey) {
    console.warn(
      'Tweet Moderator: No API key found. Please set your OpenAI API key in the extension settings.'
    );
    return;
  }

  try {
    const openAIClient = new OpenAIClient(apiKey);
    moderator = new TweetModerator(openAIClient);

    // Process tweets that are already on the page
    await moderator.processAllTweets();

    // Set up observer for new tweets
    startObserver();

    console.log('Tweet Moderator: Initialized successfully');
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
        return node.querySelectorAll('[data-testid="tweetText"]').length > 0;
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

// Listen for storage changes to reinitialize if API key changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.openaiApiKey) {
    console.log('Tweet Moderator: API key changed, reinitializing...');
    cleanup();
    initialize().catch((error) => {
      console.error('Tweet Moderator: Reinitialization failed:', error);
    });
  }
});
