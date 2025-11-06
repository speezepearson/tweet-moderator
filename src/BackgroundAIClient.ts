import { AIClient } from './AIClient';

/**
 * AIClient implementation that proxies requests to the background script
 * This avoids CORS issues by making API calls from the background context
 */
export class BackgroundAIClient implements AIClient {
  constructor(private readonly model: string) {}

  async chat(message: string, model?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'CHECK_TWEET',
          message,
          model: model || this.model,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error('No response from background script'));
            return;
          }

          if (response.success) {
            resolve(response.response);
          } else {
            reject(new Error(response.error || 'Unknown error'));
          }
        }
      );
    });
  }
}
