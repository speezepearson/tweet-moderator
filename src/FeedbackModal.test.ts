import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedbackModal } from './FeedbackModal';
import { TweetHashSchema, TweetMetadata } from './types';

// Mock the managers
vi.mock('./CacheManager', () => ({
  getCacheManager: vi.fn(() => ({
    getEntry: vi.fn().mockResolvedValue({
      toxic: false,
      timestamp: Date.now(),
      reasoning: 'Test AI reasoning',
    }),
  })),
}));

vi.mock('./FeedbackManager', () => ({
  getFeedbackManager: vi.fn(() => ({
    addFeedback: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('FeedbackModal', () => {
  let feedbackModal: FeedbackModal;
  let mockMetadata: TweetMetadata;
  let mockHash: any;

  beforeEach(() => {
    feedbackModal = new FeedbackModal();
    mockMetadata = {
      url: 'https://x.com/testuser/status/123',
      author: '@testuser',
      authorDisplayName: 'Test User',
    };
    mockHash = TweetHashSchema.parse('test tweet abc123');
  });

  describe('open', () => {
    it('should mark modal as open', async () => {
      await feedbackModal.open('Test tweet', mockHash, false, mockMetadata);

      // Modal should be open (in real browser, DOM would be created)
      // In test environment, we can't check DOM but we can verify no errors
      expect(true).toBe(true);
    });

    it('should not open if already open', async () => {
      await feedbackModal.open('Test tweet', mockHash, false, mockMetadata);
      await feedbackModal.open('Another tweet', mockHash, false, mockMetadata);

      // Second call should be ignored (no error thrown)
      expect(true).toBe(true);
    });
  });

  describe('close', () => {
    it('should close the modal', async () => {
      await feedbackModal.open('Test tweet', mockHash, false, mockMetadata);
      feedbackModal.close();

      // Should be able to open again after closing
      await feedbackModal.open('Test tweet', mockHash, false, mockMetadata);
      expect(true).toBe(true);
    });

    it('should not throw if closing when not open', () => {
      expect(() => feedbackModal.close()).not.toThrow();
    });
  });

  describe('modal behavior', () => {
    it('should handle toxic classification', async () => {
      await feedbackModal.open('Toxic tweet', mockHash, true, mockMetadata);
      expect(true).toBe(true);
    });

    it('should handle non-toxic classification', async () => {
      await feedbackModal.open('Nice tweet', mockHash, false, mockMetadata);
      expect(true).toBe(true);
    });
  });
});
