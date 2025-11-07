import { FeedbackEntry, FeedbackError, TweetHash } from './types';
import { getLocalStorage, setLocalStorage } from './storage';

/**
 * Manages user feedback for tweet classifications
 * Stores feedback in chrome.storage.local with FIFO eviction
 */
export class FeedbackManager {
  private readonly maxEntries: number;
  private readonly maxStorageSize: number;

  /**
   * @param maxEntries - Maximum number of feedback entries to keep (default: 200)
   * @param maxStorageSize - Maximum storage size in bytes (default: 2MB, well under 10MB limit)
   */
  constructor(maxEntries = 200, maxStorageSize = 2000000) {
    this.maxEntries = maxEntries;
    this.maxStorageSize = maxStorageSize;
  }

  /**
   * Adds a feedback entry to storage
   * Performs FIFO eviction if needed
   *
   * @param entry - The feedback entry to add
   */
  async addFeedback(entry: FeedbackEntry): Promise<void> {
    const entries = await this.loadFeedback();

    // Add new entry
    entries.push(entry);

    // Evict if needed
    await this.evictIfNeeded(entries);

    // Save back to storage
    await this.saveFeedback(entries);
  }

  /**
   * Retrieves all feedback entries
   *
   * @returns Array of feedback entries, sorted by timestamp (oldest first)
   */
  async getAllFeedback(): Promise<FeedbackEntry[]> {
    return this.loadFeedback();
  }

  /**
   * Deletes a specific feedback entry by hash
   *
   * @param hash - The tweet hash to delete feedback for
   */
  async deleteFeedback(hash: TweetHash): Promise<void> {
    const entries = await this.loadFeedback();
    const filtered = entries.filter((entry) => entry.hash !== hash);
    await this.saveFeedback(filtered);
  }

  /**
   * Clears all feedback entries
   */
  async clearAllFeedback(): Promise<void> {
    await setLocalStorage({ userFeedback: [] });
  }

  /**
   * Returns the current number of feedback entries
   */
  async getFeedbackCount(): Promise<number> {
    const entries = await this.loadFeedback();
    return entries.length;
  }

  /**
   * Returns the current storage size in bytes
   */
  async getStorageSize(): Promise<number> {
    const entries = await this.loadFeedback();
    return JSON.stringify(entries).length;
  }

  /**
   * Loads feedback entries from chrome.storage.local
   * Returns empty array if not found or invalid
   */
  private async loadFeedback(): Promise<FeedbackEntry[]> {
    const result = await getLocalStorage('userFeedback');
    const entries = result.userFeedback || [];

    // Validate structure - could use Zod validation here
    if (!Array.isArray(entries)) {
      console.warn('Invalid feedback structure in storage, resetting');
      return [];
    }

    return entries;
  }

  /**
   * Saves feedback entries to chrome.storage.local
   */
  private async saveFeedback(entries: FeedbackEntry[]): Promise<void> {
    try {
      await setLocalStorage({ userFeedback: entries });
    } catch (error) {
      throw new FeedbackError(
        `Failed to save feedback to storage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Evicts oldest entries if count or size limits are exceeded
   * Uses FIFO based on timestamp
   */
  private async evictIfNeeded(entries: FeedbackEntry[]): Promise<void> {
    // Check count limit
    while (entries.length > this.maxEntries) {
      // Sort by timestamp and remove oldest
      entries.sort((a, b) => a.timestamp - b.timestamp);
      entries.shift(); // Remove first (oldest)
    }

    // Check size limit
    let currentSize = JSON.stringify(entries).length;
    while (currentSize > this.maxStorageSize && entries.length > 0) {
      // Sort by timestamp and remove oldest
      entries.sort((a, b) => a.timestamp - b.timestamp);
      entries.shift();
      currentSize = JSON.stringify(entries).length;
    }
  }
}

/**
 * Global singleton instance for convenience
 */
let globalFeedbackManager: FeedbackManager | null = null;

/**
 * Gets or creates the global FeedbackManager instance
 */
export function getFeedbackManager(): FeedbackManager {
  if (!globalFeedbackManager) {
    globalFeedbackManager = new FeedbackManager();
  }
  return globalFeedbackManager;
}

/**
 * Sets a custom FeedbackManager instance (useful for testing)
 */
export function setFeedbackManager(manager: FeedbackManager): void {
  globalFeedbackManager = manager;
}
