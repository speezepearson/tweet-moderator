// COPYPASTA
const defaultSettings = {
  tweetPrefix: `
You are Tweet Moderator.
You evaluate tweets for inflammatory content.
I'm going to give you a tweet. Please check whether it does any of the following:
- seems likely to provoke anger / outrage / indignation
- takes sides on a political issue
- accuses others of morally objectionable beliefs
- is written in an angry tone that discourages disagreement

(Tip: ABSOLUTELY DO NOT start by writing your conclusion! As a large language model, every word you write is further opportunity for you to think!
There's no time pressure; think as much as you need to, in order to come to the correct conclusion.
Then end your response with 'GOOD' or 'BAD' to indicate whether the tweet does any of these 'bad' things.)


Here is the tweet:

`,
};
async function getTweetPrefix() {
  return chrome.storage.sync.get(['tweetPrefix']).then(({tweetPrefix}) => tweetPrefix || defaultSettings.tweetPrefix)
}
async function getOpenaiApiKey() {
  return chrome.storage.sync.get(['openaiApiKey']).then(({openaiApiKey}) => openaiApiKey)
}
// END COPYPASTA

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
        const hasGood = responseText.slice(-10).includes('GOOD');
        const hasBad = responseText.slice(-10).includes('BAD');
        const result = hasBad && !hasGood;
        tweetToxicityCache.set(text, result);
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
    tweetNode.style.color = 'red';
  }
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
  console.log('found', tweets.length, 'maybe-tweets');
  tweets = tweets.filter(isTweetNode);
  console.log('found', tweets.length, 'confirmed tweets');
  await Promise.all(tweets.map(checkTweet));
}

setInterval(findAndProcessAllTweets, 1000);
