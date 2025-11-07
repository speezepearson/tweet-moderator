import { AIClient } from './AIClient';
import {
  AnthropicError,
  AnthropicRequest,
  AnthropicResponse,
  AnthropicResponseSchema,
  ApiKey,
  ValidationError,
} from './types';

/**
 * Client for interacting with the Anthropic API
 * Handles authentication, request formatting, response validation, and error handling
 */
export class AnthropicClient implements AIClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.anthropic.com/v1';
  private readonly apiVersion = '2023-06-01';

  constructor(apiKey: ApiKey | string) {
    this.apiKey = apiKey;
  }

  /**
   * Makes a messages request to Anthropic API
   * Validates the response and provides detailed error handling
   *
   * @param request - The Anthropic request parameters
   * @returns Validated Anthropic response
   * @throws {AnthropicError} If the API request fails
   * @throws {ValidationError} If the response format is invalid
   */
  async createMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      const statusText = response.statusText || `HTTP ${response.status}`;
      throw new AnthropicError(
        `Anthropic API request failed: ${statusText} - ${errorText}`,
        response.status,
        errorText
      );
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch (error) {
      throw new AnthropicError(
        'Failed to parse Anthropic API response as JSON',
        response.status
      );
    }

    // Validate response structure
    const parseResult = AnthropicResponseSchema.safeParse(responseData);
    if (!parseResult.success) {
      throw new ValidationError(
        'Anthropic API response does not match expected schema',
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
   * @param model - The model to use (defaults to claude-sonnet-4-5-20250929)
   * @param systemPrompt - Optional system prompt to guide the model's behavior
   * @returns The assistant's response text
   */
  async chat(
    message: string,
    model = 'claude-sonnet-4-5-20250929',
    systemPrompt?: string
  ): Promise<string> {
    console.log('SRP: chat', {message, model, systemPrompt});
    const response = await this.createMessage({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }],
      ...(systemPrompt ? { system: systemPrompt } : {}),
    });

    const content = response.content[0]?.text;
    if (!content) {
      throw new AnthropicError('Anthropic response missing content');
    }

    return content;
  }
}

/**
 * Creates an AnthropicClient instance from an API key
 * Helper function for dependency injection and testing
 */
export function createAnthropicClient(apiKey: string): AnthropicClient {
  return new AnthropicClient(apiKey);
}
