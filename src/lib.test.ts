import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSystemPrompt, defaultSettings } from './lib';
import { FeedbackEntry, TweetHashSchema } from './types';

// Mock storage
vi.mock('./storage', () => ({
  getSyncStorage: vi.fn((key: string) => {
    if (key === 'tweetPrefix') {
      return Promise.resolve({ tweetPrefix: undefined });
    }
    return Promise.resolve({});
  }),
  setSyncStorage: vi.fn(() => Promise.resolve()),
  getLocalStorage: vi.fn(() => Promise.resolve({ userFeedback: [] })),
  setLocalStorage: vi.fn(() => Promise.resolve()),
}));

// Mock FeedbackManager
let mockFeedbackEntries: FeedbackEntry[] = [];

vi.mock('./FeedbackManager', () => ({
  getFeedbackManager: vi.fn(() => ({
    getAllFeedback: vi.fn(() => Promise.resolve(mockFeedbackEntries)),
  })),
}));

describe('lib', () => {
  beforeEach(() => {
    mockFeedbackEntries = [];
  });

  describe('getSystemPrompt', () => {
    it('should return default prompt when no feedback exists', async () => {
      const prompt = await getSystemPrompt();
      expect(prompt).toBe(defaultSettings.tweetPrefix);
    });

    it('should include feedback examples when feedback exists', async () => {
      mockFeedbackEntries = [
        {
          hash: TweetHashSchema.parse('test1 abc123'),
          text: 'This is a test tweet',
          url: 'https://x.com/test/status/123',
          author: '@test',
          authorDisplayName: 'Test User',
          timestamp: Date.now(),
          aiSaidToxic: true,
          aiReasoning: 'This seems inflammatory',
          userSaysToxic: false,
          userExplanation: 'Actually this is just informational',
        },
      ];

      const prompt = await getSystemPrompt();

      expect(prompt).toContain('IMPORTANT: Previous user feedback');
      expect(prompt).toContain('<tweet>This is a test tweet</tweet>');
      expect(prompt).toContain('type="correction"');
      expect(prompt).toContain('<explanation>Actually this is just informational</explanation>');
    });

    it('should format user agreement as confirmation', async () => {
      mockFeedbackEntries = [
        {
          hash: TweetHashSchema.parse('test1 abc123'),
          text: 'This is inflammatory',
          url: 'https://x.com/test/status/123',
          author: '@test',
          authorDisplayName: 'Test User',
          timestamp: Date.now(),
          aiSaidToxic: true,
          aiReasoning: 'This is clearly toxic',
          userSaysToxic: true,
          userExplanation: 'Yes, definitely toxic',
        },
      ];

      const prompt = await getSystemPrompt();

      expect(prompt).toContain('type="confirmation"');
      expect(prompt).toContain('<user_confirmation>');
      expect(prompt).toContain('Note: Yes, definitely toxic');
    });

    it('should format user disagreement as correction', async () => {
      mockFeedbackEntries = [
        {
          hash: TweetHashSchema.parse('test1 abc123'),
          text: 'Just sharing news',
          url: 'https://x.com/test/status/123',
          author: '@test',
          authorDisplayName: 'Test User',
          timestamp: Date.now(),
          aiSaidToxic: true,
          aiReasoning: 'Seems inflammatory',
          userSaysToxic: false,
          userExplanation: 'This is neutral reporting',
        },
      ];

      const prompt = await getSystemPrompt();

      expect(prompt).toContain('type="correction"');
      expect(prompt).toContain('<user_correction>');
      expect(prompt).toContain('<explanation>This is neutral reporting</explanation>');
      expect(prompt).toContain('<ai_reasoning>');
    });

    it('should handle multiple feedback entries', async () => {
      mockFeedbackEntries = [
        {
          hash: TweetHashSchema.parse('test1 abc123'),
          text: 'Tweet 1',
          url: 'https://x.com/test/status/123',
          author: '@test',
          authorDisplayName: 'Test User',
          timestamp: Date.now(),
          aiSaidToxic: true,
          aiReasoning: 'Reason 1',
          userSaysToxic: false,
          userExplanation: 'Explanation 1',
        },
        {
          hash: TweetHashSchema.parse('test2 def456'),
          text: 'Tweet 2',
          url: 'https://x.com/test/status/456',
          author: '@test',
          authorDisplayName: 'Test User',
          timestamp: Date.now(),
          aiSaidToxic: false,
          aiReasoning: 'Reason 2',
          userSaysToxic: false,
          userExplanation: 'Explanation 2',
        },
      ];

      const prompt = await getSystemPrompt();

      expect(prompt).toContain('id="1"');
      expect(prompt).toContain('id="2"');
      expect(prompt).toContain('<tweet>Tweet 1</tweet>');
      expect(prompt).toContain('<tweet>Tweet 2</tweet>');
    });

    it('should handle feedback without explanation', async () => {
      mockFeedbackEntries = [
        {
          hash: TweetHashSchema.parse('test1 abc123'),
          text: 'Test tweet',
          url: 'https://x.com/test/status/123',
          author: '@test',
          authorDisplayName: 'Test User',
          timestamp: Date.now(),
          aiSaidToxic: true,
          aiReasoning: 'Seems bad',
          userSaysToxic: false,
          userExplanation: '(No explanation provided)',
        },
      ];

      const prompt = await getSystemPrompt();

      expect(prompt).toContain('<tweet>Test tweet</tweet>');
      expect(prompt).not.toContain('(No explanation provided)');
      expect(prompt).not.toContain('<explanation>');
    });
  });
});
