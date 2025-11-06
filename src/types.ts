import { z } from 'zod';

/**
 * Branded type for tweets to ensure type safety
 */
export const TweetSchema = z.string().min(1).brand('Tweet');
export type Tweet = z.infer<typeof TweetSchema>;

/**
 * Branded type for tweet hashes to prevent mixing with regular strings
 */
export const TweetHashSchema = z.string().min(1).brand('TweetHash');
export type TweetHash = z.infer<typeof TweetHashSchema>;

/**
 * Branded type for OpenAI API keys
 */
export const ApiKeySchema = z.string().min(1).brand('ApiKey');
export type ApiKey = z.infer<typeof ApiKeySchema>;

/**
 * Classification keywords used in prompt responses
 */
export const KeywordsSchema = z.object({
  good: z.string(),
  bad: z.string(),
});
export type Keywords = z.infer<typeof KeywordsSchema>;

/**
 * Settings schema with validation
 */
export const SettingsSchema = z.object({
  tweetPrefix: z.string().min(1),
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  aiBackend: z.enum(['openai', 'anthropic']).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * OpenAI API message schema
 */
export const OpenAIMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});
export type OpenAIMessage = z.infer<typeof OpenAIMessageSchema>;

/**
 * OpenAI API request schema
 */
export const OpenAIRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OpenAIMessageSchema),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
});
export type OpenAIRequest = z.infer<typeof OpenAIRequestSchema>;

/**
 * OpenAI API response schema with validation
 */
export const OpenAIResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z
    .array(
      z.object({
        index: z.number(),
        message: z.object({
          role: z.string(),
          content: z.string(),
        }),
        finish_reason: z.string(),
      })
    )
    .min(1, 'Response must contain at least one choice'),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});
export type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

/**
 * Anthropic API message schema
 */
export const AnthropicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;

/**
 * Anthropic API request schema
 */
export const AnthropicRequestSchema = z.object({
  model: z.string(),
  messages: z.array(AnthropicMessageSchema),
  max_tokens: z.number(),
  temperature: z.number().optional(),
});
export type AnthropicRequest = z.infer<typeof AnthropicRequestSchema>;

/**
 * Anthropic API response schema
 */
export const AnthropicResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(
    z.object({
      type: z.literal('text'),
      text: z.string(),
    })
  ).min(1, 'Response must contain at least one content block'),
  model: z.string(),
  stop_reason: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});
export type AnthropicResponse = z.infer<typeof AnthropicResponseSchema>;

/**
 * Cache entry schema
 */
export const CacheEntrySchema = z.object({
  hash: TweetHashSchema,
  toxic: z.boolean(),
  timestamp: z.number(),
});
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

/**
 * Persistent cache schema (stored in chrome.storage)
 */
export const PersistentCacheSchema = z.record(
  z.string(), // hash
  z.object({
    toxic: z.boolean(),
    timestamp: z.number(),
  })
);
export type PersistentCache = z.infer<typeof PersistentCacheSchema>;

/**
 * Error types for better error handling
 */
export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly zodError?: z.ZodError) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}
