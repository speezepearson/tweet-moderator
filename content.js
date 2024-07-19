// COPYPASTA
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
Then end your response with 'INFLAMMATORY' or 'SAFE' indicating whether the tweet does any of these things.)


Here is the tweet:

`,
};
async function getTweetPrefix() {
  return chrome.storage.sync.get(['tweetPrefix']).then(({tweetPrefix}) => tweetPrefix || defaultSettings.tweetPrefix)
}
// END COPYPASTA

async function getOpenaiApiKey() {
  return chrome.storage.sync.get(['openaiApiKey']).then(({openaiApiKey}) => openaiApiKey)
}

/** @typedef {string} TweetHash */
/**
 * @param {string} tweet
 * @returns {Promise<TweetHash>}
 */
async function hashTweet(tweet) {
  const encoder = new TextEncoder();
  const data = encoder.encode(tweet);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return tweet.slice(0, 100) + ' ' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** @typedef {Object.<string, {lastUpdatedMs: number, results: boolean[]}>} TweetToxicityCache */


/**
 * @returns {Promise<TweetToxicityCache>}
 */
async function getTweetToxicityCache() {
  return chrome.storage.local.get(['tweetToxicity']).then(({tweetToxicity}) => tweetToxicity || {})
}

/**
 * @param {string} tweet
 * @returns {undefined|Promise<boolean>}
 */
async function getStoredTweetToxicity(tweet) {
  const cache = await getTweetToxicityCache();
  const cacheKey = await hashTweet(tweet);
  const info = cache[cacheKey];
  if (info === undefined) {
    return undefined;
  }
  const nYes = info.results.filter(x => x).length;
  const nNo = info.results.length - nYes;
  if (nYes > 1) return true;
  if (nNo > 1) return false;
  return undefined;
}
/**
 * @param {string} tweet
 * @param {boolean} isToxic
 */
async function recordTweetToxicity(tweet, isToxic) {
  const cache = await getTweetToxicityCache();
  const cacheKey = await hashTweet(tweet);
  let cachedInfo = cache[cacheKey];
  if (!cachedInfo) {
    cachedInfo = {lastUpdatedMs: Date.now(), results: []};
  }
  cachedInfo.results.push(isToxic);

  // while the cache is too big, remove the oldest entry
  while (JSON.stringify(cache).length > 500000) {
    const oldestTweet = Object.entries(cache).reduce((a, b) => a[1].lastUpdatedMs < b[1].lastUpdatedMs ? a : b)[0];
    delete cache[oldestTweet];
  }

  await chrome.storage.local.set({tweetToxicity: {...cache, [cacheKey]: cachedInfo}});
}

/** @type {Map<Element, boolean>} */
const tweetToxicityCache = new Map();
/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function isTweetToxic(text) {
    const cachedValue = tweetToxicityCache.get(text);
    if (cachedValue !== undefined) {
        return cachedValue;
    }
    const storedValue = await getStoredTweetToxicity(text);
    if (storedValue !== undefined) {
      return storedValue;
    }

    const openaiApiKey = await getOpenaiApiKey();
    if (!openaiApiKey) return false;

    try {
      console.log('checking', text)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  // {
                  //   role: 'system',
                  //   content: await getSystemPrompt(),
                  // },
                  {
                    role: 'user',
                    content: (await getTweetPrefix()) + text,
                  },
                ],
                temperature: 0.7,
                max_tokens: 1000,
              })
        });
        const responseJ = await response.json();
        /** @type {string} */
        const responseText = responseJ.choices[0].message.content;
        const hasGood = responseText.slice(-10).includes('SAFE');
        const hasBad = responseText.slice(-10).includes('INFLAMMATORY');
        const result = hasBad && !hasGood;
        tweetToxicityCache.set(text, result);
        await recordTweetToxicity(text, result);
        console.log({text, responseText, response: responseJ, toxic: result});
        return result;
    } catch (error) {
        console.error('Error moderating tweet:', error);
        return false;
    }
}

/** @type {Set<Element>} */
const processedTweets = new Set();
/**
 * @param {Element} tweetNode
 * @returns {Promise<void>}
 */
async function checkTweet(tweetNode) {
  
  if (processedTweets.has(tweetNode)) {
    return;
  }
  processedTweets.add(tweetNode); // add at beginning rather than end of func to prevent other calls from making API calls for it as well

  if (await isTweetToxic(tweetNode.innerText)) {
    let parentArticle = getParentArticle(tweetNode);
    if (parentArticle) {
      parentArticle.remove();
    }
  }
}

/**
 * @param {Element} node
 * @returns {Element}
 */
function getParentArticle(node) {
  let parentArticle = node;
  while (parentArticle && parentArticle.tagName !== 'ARTICLE') {
    parentArticle = parentArticle.parentElement;
  }
  return parentArticle;

}


/**
 * @param {Element} node 
 * @returns {boolean}
 */
function isTweetNode(node) {
  return node.getAttribute('data-testid') === 'tweetText'
}

const tweetClass = 'r-8akbws';
async function findAndProcessAllTweets() {
  let tweets = Array.from(document.getElementsByClassName(tweetClass));
  tweets = tweets.filter(isTweetNode);
  await Promise.all(tweets.map(checkTweet));
}

setInterval(findAndProcessAllTweets, 1000);
