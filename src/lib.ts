import { AIBackend } from './AIClient';
import { Keywords, Settings, SettingsSchema } from './types';

/**
 * Classification keywords used to parse OpenAI responses
 */
export const keywords: Keywords = {
  good: 'DOES NOT DO THE ABOVE',
  bad: 'DOES THE ABOVE',
};

/**
 * Maximum length of classification keywords
 * Used to extract the classification from the end of API responses
 */
export const maxKeywordLength = Math.max(
  ...Object.values(keywords).map((v) => v.length)
);

/**
 * Default settings for the extension
 */
export const defaultSettings: Settings = {
  tweetPrefix: `
You are Tweet Moderator.
You evaluate tweets for inflammatory content.
I'm going to give you a tweet. Please check whether it does any of the following:
- seems likely to provoke anger / outrage / indignation
- employs sarcasm
- takes sides on a political issue
- accuses others of morally objectionable beliefs
- is written in an angry tone that discourages disagreement

(Tip: ABSOLUTELY DO NOT start by writing your conclusion! As a large language model, every word you write is further opportunity for you to think!
There's no time pressure; think as much as you need to, in order to come to the correct conclusion.
Then end your response with '${keywords.bad}' or '${keywords.good}' indicating whether the tweet does any of these things.)


Here is the tweet:

`,
};

/**
 * Retrieves the tweet moderation prompt from storage
 * Falls back to default settings if not configured
 */
export async function getTweetPrefix(): Promise<string> {
  const result = await chrome.storage.sync.get(['tweetPrefix']);
  const tweetPrefix = result.tweetPrefix || defaultSettings.tweetPrefix;

  // Validate that it's a string
  if (typeof tweetPrefix !== 'string') {
    console.warn('Invalid tweetPrefix in storage, using default');
    return defaultSettings.tweetPrefix;
  }

  return tweetPrefix;
}

/**
 * Retrieves the OpenAI API key from storage
 * Returns undefined if not set
 */
export async function getOpenaiApiKey(): Promise<string | undefined> {
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  const apiKey = result.openaiApiKey;

  if (apiKey && typeof apiKey !== 'string') {
    console.warn('Invalid openaiApiKey in storage');
    return undefined;
  }

  return apiKey;
}

/**
 * Retrieves the Anthropic API key from storage
 * Returns undefined if not set
 */
export async function getAnthropicApiKey(): Promise<string | undefined> {
  const result = await chrome.storage.sync.get(['anthropicApiKey']);
  const apiKey = result.anthropicApiKey;

  if (apiKey && typeof apiKey !== 'string') {
    console.warn('Invalid anthropicApiKey in storage');
    return undefined;
  }

  return apiKey;
}

/**
 * Retrieves the selected AI backend from storage
 * Defaults to 'openai' if not set
 */
export async function getAIBackend(): Promise<AIBackend> {
  const result = await chrome.storage.sync.get(['aiBackend']);
  const backend = result.aiBackend;

  if (backend === 'openai' || backend === 'anthropic') {
    return backend;
  }

  return 'openai'; // Default to OpenAI
}

/**
 * Saves settings to Chrome storage
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  // Validate settings
  const validatedSettings = SettingsSchema.partial().parse(settings);

  if (validatedSettings.tweetPrefix !== undefined) {
    await chrome.storage.sync.set({ tweetPrefix: validatedSettings.tweetPrefix });
  }

  if (validatedSettings.openaiApiKey !== undefined) {
    await chrome.storage.sync.set({ openaiApiKey: validatedSettings.openaiApiKey });
  }

  if (validatedSettings.anthropicApiKey !== undefined) {
    await chrome.storage.sync.set({
      anthropicApiKey: validatedSettings.anthropicApiKey,
    });
  }

  if (validatedSettings.aiBackend !== undefined) {
    await chrome.storage.sync.set({ aiBackend: validatedSettings.aiBackend });
  }
}
