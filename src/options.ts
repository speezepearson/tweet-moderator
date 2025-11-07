import { getBaseTweetPrefix, saveSettings } from './lib';
import { setLocalStorage } from './storage';
import { getFeedbackManager } from './FeedbackManager';

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

  // Load current settings (base prompt only, without feedback examples)
  try {
    const currentPrefix = await getBaseTweetPrefix();
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

  // Handle feedback management
  const feedbackManager = getFeedbackManager();
  const feedbackList = document.getElementById('feedback-list');
  const feedbackStats = document.getElementById('feedback-stats');
  const refreshFeedbackBtn = document.getElementById('refresh-feedback-btn');
  const clearFeedbackBtn = document.getElementById('clear-feedback-btn');

  async function loadFeedback() {
    if (!feedbackList || !feedbackStats) return;

    try {
      const entries = await feedbackManager.getAllFeedback();
      const count = entries.length;

      // Update stats
      const corrections = entries.filter(e => e.aiSaidToxic !== e.userSaysToxic).length;
      const confirmations = count - corrections;
      feedbackStats.textContent = `Total: ${count} entries (${corrections} corrections, ${confirmations} confirmations)`;

      // Render feedback list
      if (count === 0) {
        feedbackList.innerHTML = '<p style="color: #999; text-align: center;">No feedback entries yet. Use the "AI Feedback" button on tweets to provide feedback.</p>';
        return;
      }

      feedbackList.innerHTML = entries
        .map((entry, index) => {
          const userDisagreed = entry.aiSaidToxic !== entry.userSaysToxic;
          const aiClassification = entry.aiSaidToxic ? 'Toxic' : 'Not Toxic';
          const correctClassification = entry.userSaysToxic ? 'Toxic' : 'Not Toxic';
          const date = new Date(entry.timestamp).toLocaleString();
          const entryType = userDisagreed ? 'CORRECTION' : 'CONFIRMATION';
          const bgColor = userDisagreed ? '#fff3cd' : '#d1ecf1';

          return `
            <div style="border: 1px solid #ddd; padding: 12px; margin-bottom: 10px; border-radius: 4px; background-color: ${bgColor};">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <strong style="color: ${userDisagreed ? '#856404' : '#0c5460'};">${entryType} #${index + 1}</strong>
                <small style="color: #666;">${date}</small>
              </div>
              <div style="margin-bottom: 8px;">
                <strong>Tweet:</strong> "${entry.text.substring(0, 100)}${entry.text.length > 100 ? '...' : ''}"
              </div>
              <div style="margin-bottom: 8px;">
                <strong>Author:</strong> ${entry.authorDisplayName} (${entry.author})
                <a href="${entry.url}" target="_blank" style="margin-left: 8px; font-size: 12px;">View</a>
              </div>
              <div style="margin-bottom: 8px;">
                <strong>AI said:</strong> ${aiClassification} → <strong>User says:</strong> ${correctClassification}
              </div>
              ${entry.userExplanation !== '(No explanation provided)' ? `
                <div style="margin-bottom: 8px; padding: 8px; background-color: rgba(255,255,255,0.5); border-radius: 4px;">
                  <strong>Explanation:</strong> ${entry.userExplanation}
                </div>
              ` : ''}
              <button data-hash="${entry.hash}" class="delete-feedback-btn" style="font-size: 12px; padding: 4px 8px; cursor: pointer;">Delete</button>
            </div>
          `;
        })
        .join('');

      // Add delete button listeners
      const deleteButtons = feedbackList.querySelectorAll('.delete-feedback-btn');
      deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.target as HTMLElement;
          const hash = target.getAttribute('data-hash');
          if (!hash || !confirm('Delete this feedback entry?')) return;

          try {
            await feedbackManager.deleteFeedback(hash as any);
            await loadFeedback();
          } catch (error) {
            console.error('Error deleting feedback:', error);
            alert(`Failed to delete feedback: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      });
    } catch (error) {
      console.error('Error loading feedback:', error);
      feedbackList.innerHTML = `<p style="color: red;">Error loading feedback: ${error instanceof Error ? error.message : String(error)}</p>`;
    }
  }

  // Initial load
  loadFeedback();

  // Refresh button
  if (refreshFeedbackBtn) {
    refreshFeedbackBtn.addEventListener('click', loadFeedback);
  }

  // Clear all button
  if (clearFeedbackBtn) {
    clearFeedbackBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete ALL feedback entries? This cannot be undone.')) {
        return;
      }

      try {
        await feedbackManager.clearAllFeedback();
        await loadFeedback();
        alert('All feedback cleared successfully.');
      } catch (error) {
        console.error('Error clearing feedback:', error);
        alert(`Failed to clear feedback: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
});
