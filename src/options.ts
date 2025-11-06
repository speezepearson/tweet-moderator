import { getSystemPrompt, saveSettings } from './lib';

/**
 * Options page script for the Tweet Moderator extension
 * Handles settings UI and storage
 */

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  if (!form || !(form instanceof HTMLFormElement)) {
    console.error('Settings form not found');
    return;
  }

  // Type-safe form field access
  const tweetPrefixField = form.elements.namedItem('tweetPrefix');
  const anthropicApiKeyField = form.elements.namedItem('anthropicApiKey');

  if (
    !tweetPrefixField ||
    !(tweetPrefixField instanceof HTMLTextAreaElement) ||
    !anthropicApiKeyField ||
    !(anthropicApiKeyField instanceof HTMLInputElement)
  ) {
    console.error('Form fields not found or have incorrect types');
    return;
  }

  // Load current settings
  try {
    const currentPrefix = await getSystemPrompt();
    tweetPrefixField.value = currentPrefix;
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  // Save settings on form submit
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const tweetPrefix = tweetPrefixField.value.trim();
    const anthropicApiKey = anthropicApiKeyField.value.trim();

    if (!tweetPrefix) {
      alert('System prompt cannot be empty');
      return;
    }

    try {
      await saveSettings({
        tweetPrefix,
        ...(anthropicApiKey ? { anthropicApiKey } : {}),
      });

      alert('Settings saved successfully');

      // Clear the API key field after saving for security
      anthropicApiKeyField.value = '';
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(
        `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
});
