import { AIClient, DEFAULT_MODELS } from './AIClient';
import { AnthropicClient } from './AnthropicClient';
import { getAIBackend, getAnthropicApiKey, getOpenaiApiKey } from './lib';
import { OpenAIClient } from './OpenAIClient';

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
    handleCheckTweet(request.message, request.model)
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

async function handleCheckTweet(message: string, model: string): Promise<string> {
  const backend = await getAIBackend();
  let aiClient: AIClient;

  if (backend === 'openai') {
    const apiKey = await getOpenaiApiKey();
    if (!apiKey) {
      throw new Error('No OpenAI API key found');
    }
    aiClient = new OpenAIClient(apiKey);
  } else if (backend === 'anthropic') {
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
      throw new Error('No Anthropic API key found');
    }
    aiClient = new AnthropicClient(apiKey);
  } else {
    throw new Error(`Unknown backend: ${backend}`);
  }

  return aiClient.chat(message, model || DEFAULT_MODELS[backend]);
}
