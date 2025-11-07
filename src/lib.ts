import { Keywords, Settings, SettingsSchema } from './types';
import { getSyncStorage, setSyncStorage } from './storage';
import { getFeedbackManager } from './FeedbackManager';

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
`,
};

/**
 * Formats feedback entries for inclusion in system prompt
 * Creates examples of user corrections to help AI learn
 * Uses XML-style tags for clear structure and to prevent prompt confusion
 */
async function formatFeedbackExamples(): Promise<string> {
  const feedbackManager = getFeedbackManager();
  const feedbackEntries = await feedbackManager.getAllFeedback();

  if (feedbackEntries.length === 0) {
    return '';
  }

  const examples = feedbackEntries.map((entry, index) => {
    const userDisagreed = entry.aiSaidToxic !== entry.userSaysToxic;
    const aiClassification = entry.aiSaidToxic ? 'toxic' : 'not toxic';
    const correctClassification = entry.userSaysToxic ? 'toxic' : 'not toxic';
    const exampleType = userDisagreed ? 'correction' : 'confirmation';

    if (!userDisagreed) {
      // User agreed - include as confirmation
      return `<example id="${index + 1}" type="${exampleType}">
  <tweet>${entry.text}</tweet>

  <ai_classification>${aiClassification}</ai_classification>

  <user_confirmation>
    Correct, this tweet is ${correctClassification}
    ${entry.userExplanation !== '(No explanation provided)' ? `\n    Note: ${entry.userExplanation}` : ''}
  </user_confirmation>
</example>`;
    } else {
      // User disagreed - include as correction
      return `<example id="${index + 1}" type="${exampleType}">
  <tweet>${entry.text}</tweet>

  <ai_classification>${aiClassification}</ai_classification>

  <ai_reasoning>
${entry.aiReasoning}
  </ai_reasoning>

  <user_correction>
    <correct_classification>${correctClassification}</correct_classification>
    ${entry.userExplanation !== '(No explanation provided)' ? `<explanation>${entry.userExplanation}</explanation>` : ''}
  </user_correction>
</example>`;
    }
  });

  return `
IMPORTANT: Previous user feedback on classifications (learn from these examples):

${examples.join('\n\n')}

═══════════════════════════════════════════════════

Now, evaluate the following NEW tweet (ignore all examples above):

`;
}

/**
 * Retrieves the base tweet moderation prompt from storage (without feedback examples)
 * Falls back to default settings if not configured
 * Use this for the settings UI to avoid duplicating feedback examples
 */
export async function getBaseTweetPrefix(): Promise<string> {
  const result = await getSyncStorage('tweetPrefix');
  const tweetPrefix = result.tweetPrefix || defaultSettings.tweetPrefix;

  // Validate that it's a string
  if (typeof tweetPrefix !== 'string') {
    console.warn('Invalid tweetPrefix in storage, using default');
    return defaultSettings.tweetPrefix;
  }

  return tweetPrefix;
}

/**
 * Retrieves the tweet moderation system prompt from storage
 * Falls back to default settings if not configured
 * Includes user feedback examples for AI learning
 * Use this for actual tweet moderation
 */
export async function getSystemPrompt(): Promise<string> {
  const tweetPrefix = await getBaseTweetPrefix();

  // Add feedback examples if available
  const feedbackSection = await formatFeedbackExamples();

  return tweetPrefix + feedbackSection;
}

/**
 * @deprecated Use getSystemPrompt() instead
 */
export async function getTweetPrefix(): Promise<string> {
  return getSystemPrompt();
}

/**
 * Retrieves the Anthropic API key from storage
 * Returns undefined if not set
 */
export async function getAnthropicApiKey(): Promise<string | undefined> {
  const result = await getSyncStorage('anthropicApiKey');
  const apiKey = result.anthropicApiKey;

  if (apiKey && typeof apiKey !== 'string') {
    console.warn('Invalid anthropicApiKey in storage');
    return undefined;
  }

  return apiKey;
}

/**
 * Saves settings to Chrome storage
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  // Validate settings
  const validatedSettings = SettingsSchema.partial().parse(settings);

  if (validatedSettings.tweetPrefix !== undefined) {
    await setSyncStorage({ tweetPrefix: validatedSettings.tweetPrefix });
  }

  if (validatedSettings.anthropicApiKey !== undefined) {
    await setSyncStorage({
      anthropicApiKey: validatedSettings.anthropicApiKey,
    });
  }
}
