import { DEFAULT_MODEL } from './AIClient';
import { AnthropicClient } from './AnthropicClient';
import { getAnthropicApiKey } from './lib';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Tweet Moderator extension installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.includes('x.com') || tab.url.includes('twitter.com'))
  ) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'],
    });
  }
});

// Handle messages from content script for AI API calls
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'CHECK_TWEET') {
    handleCheckTweet(request.message, request.model, request.systemPrompt)
      .then((response) => sendResponse({ success: true, response }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    return true; // Keep channel open for async response
  }
  return false; // Don't keep channel open for other message types
});

async function handleCheckTweet(
  message: string,
  model: string,
  systemPrompt?: string
): Promise<string> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('No Anthropic API key found');
  }

  const aiClient = new AnthropicClient(apiKey);
  return aiClient.chat(message, model || DEFAULT_MODEL, systemPrompt);
}
