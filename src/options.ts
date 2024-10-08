// COPYPASTA
// @ts-ignore
const keywords = { good: 'DOES NOT DO THE ABOVE', bad: 'DOES THE ABOVE' };
// @ts-ignore
const maxKeywordLength = Math.max(...Object.values(keywords).map(v => v.length));
// @ts-ignore
const defaultSettings = {
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
// @ts-ignore
async function getTweetPrefix(): Promise<string> {
  return chrome.storage.sync.get(['tweetPrefix']).then(({ tweetPrefix }) => tweetPrefix || defaultSettings.tweetPrefix)
}
// END COPYPASTA

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('settings-form') as HTMLFormElement;
  if (!form) return;

  getTweetPrefix().then(p => form.tweetPrefix.value = p);

  // Save settings
  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const tweetPrefix = form.tweetPrefix.value;
    chrome.storage.sync.set({ tweetPrefix }, function () {
      alert('Settings saved');
    });

    const openaiApiKey = form.openaiApiKey.value;
    if (openaiApiKey) {
      chrome.storage.sync.set({ openaiApiKey }, function () {
        alert('API key saved');
      });
    }

    return false;
  });
});
