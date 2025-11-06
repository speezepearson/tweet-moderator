import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIClient, createOpenAIClient } from './OpenAIClient';
import { OpenAIError, ValidationError } from './types';

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  const testApiKey = 'test-api-key-123';

  beforeEach(() => {
    client = new OpenAIClient(testApiKey);
    // Clear all mocks
    vi.restoreAllMocks();
  });

  describe('chatCompletion', () => {
    it('should make successful API call with valid response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a test response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test message' }],
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testApiKey}`,
          },
        })
      );
    });

    it('should throw OpenAIError when API request fails with 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      await expect(
        client.chatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow(OpenAIError);

      await expect(
        client.chatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw OpenAIError when API request fails with 429 rate limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      const error = await client
        .chatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(OpenAIError);
      expect(error.statusCode).toBe(429);
    });

    it('should throw OpenAIError when response is not valid JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(
        client.chatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow(OpenAIError);
    });

    it('should throw ValidationError when response schema is invalid', async () => {
      const invalidResponse = {
        // Missing required fields like 'id', 'choices', etc.
        foo: 'bar',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => invalidResponse,
      });

      await expect(
        client.chatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when choices array is empty', async () => {
      const invalidResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [], // Empty choices array
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => invalidResponse,
      });

      await expect(
        client.chatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('simpleChat', () => {
    it('should return assistant response text for simple chat', async () => {
      const responseText = 'This is a simple response';
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseText,
            },
            finish_reason: 'stop',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.simpleChat('Hello');

      expect(result).toBe(responseText);
    });

    it('should use default model gpt-4o', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await client.simpleChat('Test');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.model).toBe('gpt-4o');
    });

    it('should accept custom model', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await client.simpleChat('Test', 'gpt-4o');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.model).toBe('gpt-4o');
    });

    it('should throw OpenAIError when response has no content', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
            },
            finish_reason: 'stop',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(client.simpleChat('Test')).rejects.toThrow(OpenAIError);
      await expect(client.simpleChat('Test')).rejects.toThrow('missing content');
    });
  });

  describe('createOpenAIClient', () => {
    it('should create client with provided API key', () => {
      const newClient = createOpenAIClient('new-api-key');
      expect(newClient).toBeInstanceOf(OpenAIClient);
    });
  });
});
