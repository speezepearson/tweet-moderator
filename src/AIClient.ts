/**
 * Abstract interface for AI API clients
 * Allows switching between different AI providers (OpenAI, Anthropic, etc.)
 */
export interface AIClient {
  /**
   * Sends a chat message and returns the response text
   *
   * @param message - The user message to send
   * @param model - Optional model override
   * @returns The AI's response text
   */
  chat(message: string, model?: string): Promise<string>;
}

/**
 * Supported AI backend providers
 */
export type AIBackend = 'openai' | 'anthropic';

/**
 * Default models for each backend
 */
export const DEFAULT_MODELS: Record<AIBackend, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
};
