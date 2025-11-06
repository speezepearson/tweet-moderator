import { getAIBackend, getTweetPrefix, saveSettings } from './lib';

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
  const openaiApiKeyField = form.elements.namedItem('openaiApiKey');
  const anthropicApiKeyField = form.elements.namedItem('anthropicApiKey');
  const aiBackendField = form.elements.namedItem('aiBackend');

  if (
    !tweetPrefixField ||
    !(tweetPrefixField instanceof HTMLTextAreaElement) ||
    !openaiApiKeyField ||
    !(openaiApiKeyField instanceof HTMLInputElement) ||
    !anthropicApiKeyField ||
    !(anthropicApiKeyField instanceof HTMLInputElement) ||
    !aiBackendField ||
    !(aiBackendField instanceof HTMLSelectElement)
  ) {
    console.error('Form fields not found or have incorrect types');
    return;
  }

  // Load current settings
  try {
    const currentPrefix = await getTweetPrefix();
    tweetPrefixField.value = currentPrefix;

    const currentBackend = await getAIBackend();
    aiBackendField.value = currentBackend;
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  // Save settings on form submit
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const tweetPrefix = tweetPrefixField.value.trim();
    const openaiApiKey = openaiApiKeyField.value.trim();
    const anthropicApiKey = anthropicApiKeyField.value.trim();
    const aiBackend = aiBackendField.value as 'openai' | 'anthropic';

    if (!tweetPrefix) {
      alert('Tweet prefix cannot be empty');
      return;
    }

    try {
      await saveSettings({
        tweetPrefix,
        aiBackend,
        ...(openaiApiKey ? { openaiApiKey } : {}),
        ...(anthropicApiKey ? { anthropicApiKey } : {}),
      });

      alert('Settings saved successfully');

      // Clear the API key fields after saving for security
      openaiApiKeyField.value = '';
      anthropicApiKeyField.value = '';
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(
        `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
});
