console.log('hello');

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

    try {
      console.log('checking', text)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-proj-nBMjZZQle5T1sKUm6b8dT3BlbkFJIV25Th8XCAyWq4tMnB8c',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: `You are Tweet Moderator. Tweet Moderator evaluates tweets for potentially inflammatory or divisive content. It checks whether the tweet seems to provoke anger, takes sides on a political issue, accuses others of morally objectionable beliefs, or is written in an angry tone that discourages disagreement. It should think as much as it needs to in order to come to the correct conclusion, and end its response with 'YES' or 'NO' to indicate if the tweet does any of these 'bad' things.`,
                  },
                  {
                    role: 'user',
                    content: `Tweet: ${text}`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 1000,
              })
        });
        const responseJ = await response.json();
        const responseText = responseJ.choices[0].message.content;
        const result = responseText.trim().endsWith('YES') || responseText.trim().endsWith('YES.');
        tweetToxicityCache.set(text, result);
        console.log({text, response: responseJ, toxic: result});
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
