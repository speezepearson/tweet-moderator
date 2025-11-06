import { getSystemPrompt, saveSettings } from './lib';
import { setLocalStorage } from './storage';

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

  // Handle cache clearing
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  const cacheStatus = document.getElementById('cache-status');

  if (clearCacheBtn && cacheStatus) {
    clearCacheBtn.addEventListener('click', async () => {
      try {
        // Clear the persistent cache in chrome.storage
        // Type-safe: will get a TypeScript error if we use the wrong key
        await setLocalStorage({ tweetToxicityCache: {} });

        cacheStatus.textContent = 'Cache cleared successfully! Reload Twitter/X to see changes.';
        cacheStatus.style.color = 'green';

        setTimeout(() => {
          cacheStatus.textContent = '';
        }, 5000);
      } catch (error) {
        console.error('Error clearing cache:', error);
        cacheStatus.textContent = `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`;
        cacheStatus.style.color = 'red';
      }
    });
  }
});
