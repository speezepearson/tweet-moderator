/**
 * Abstract interface for AI API clients
 */
export interface AIClient {
  /**
   * Sends a chat message and returns the response text
   *
   * @param message - The user message to send
   * @param model - Optional model override
   * @param systemPrompt - Optional system prompt to guide the model's behavior
   * @returns The AI's response text
   */
  chat(message: string, model?: string, systemPrompt?: string): Promise<string>;
}

/**
 * Default Anthropic model
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
