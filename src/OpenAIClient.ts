import { AIClient } from './AIClient';
import {
  ApiKey,
  OpenAIError,
  OpenAIRequest,
  OpenAIResponse,
  OpenAIResponseSchema,
  ValidationError,
} from './types';

/**
 * Client for interacting with the OpenAI API
 * Handles authentication, request formatting, response validation, and error handling
 */
export class OpenAIClient implements AIClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: ApiKey | string) {
    this.apiKey = apiKey;
  }

  /**
   * Makes a chat completion request to OpenAI API
   * Validates the response and provides detailed error handling
   *
   * @param request - The OpenAI request parameters
   * @returns Validated OpenAI response
   * @throws {OpenAIError} If the API request fails
   * @throws {ValidationError} If the response format is invalid
   */
  async chatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new OpenAIError(
        `OpenAI API request failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch (error) {
      throw new OpenAIError('Failed to parse OpenAI API response as JSON', response.status);
    }

    // Validate response structure
    const parseResult = OpenAIResponseSchema.safeParse(responseData);
    if (!parseResult.success) {
      throw new ValidationError(
        'OpenAI API response does not match expected schema',
        parseResult.error
      );
    }

    return parseResult.data;
  }

  /**
   * Sends a chat message and returns the response text
   * Implements the AIClient interface
   *
   * @param message - The user message to send
   * @param model - The model to use (defaults to gpt-4o)
   * @returns The assistant's response text
   */
  async chat(message: string, model = 'gpt-4o'): Promise<string> {
    const response = await this.chatCompletion({
      model,
      messages: [{ role: 'user', content: message }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenAIError('OpenAI response missing content');
    }

    return content;
  }

  /**
   * @deprecated Use chat() instead
   * Helper method to create a simple chat completion with a single user message
   *
   * @param message - The user message to send
   * @param model - The model to use (defaults to gpt-4o)
   * @returns The assistant's response text
   */
  async simpleChat(message: string, model = 'gpt-4o'): Promise<string> {
    return this.chat(message, model);
  }
}

/**
 * Creates an OpenAIClient instance from an API key
 * Helper function for dependency injection and testing
 */
export function createOpenAIClient(apiKey: string): OpenAIClient {
  return new OpenAIClient(apiKey);
}
