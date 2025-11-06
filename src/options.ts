import { getTweetPrefix, saveSettings } from './lib';

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
  const apiKeyField = form.elements.namedItem('openaiApiKey');

  if (
    !tweetPrefixField ||
    !(tweetPrefixField instanceof HTMLTextAreaElement) ||
    !apiKeyField ||
    !(apiKeyField instanceof HTMLInputElement)
  ) {
    console.error('Form fields not found or have incorrect types');
    return;
  }

  // Load current settings
  try {
    const currentPrefix = await getTweetPrefix();
    tweetPrefixField.value = currentPrefix;
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  // Save settings on form submit
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const tweetPrefix = tweetPrefixField.value.trim();
    const openaiApiKey = apiKeyField.value.trim();

    if (!tweetPrefix) {
      alert('Tweet prefix cannot be empty');
      return;
    }

    try {
      await saveSettings({
        tweetPrefix,
        ...(openaiApiKey ? { openaiApiKey } : {}),
      });

      alert('Settings saved successfully');

      // Clear the API key field after saving for security
      apiKeyField.value = '';
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(`Failed to save settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});
