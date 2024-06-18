console.log('hello');

let numCalls = 0;
const tweetToxicityCache = {};
async function isTweetToxic(text) {
    if (tweetToxicityCache[text] !== undefined) {
        if (tweetToxicityCache[text] === 'loading') { return; }
        // console.log('Cache hit for tweet:', text);
        return tweetToxicityCache[text];
    }
    tweetToxicityCache[text] = 'loading';

    numCalls++;
    // if (numCalls > 10) { return true; }
    // console.log({numCalls, text});

    // console.log('Moderating tweet:', text);
    try {
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
        tweetToxicityCache[text] = result;
        console.log({text, response: responseJ, toxic: result});
        return result;
    } catch (error) {
        console.error('Error moderating tweet:', error);
        return false;
    }
}







const tweetClass = 'r-8akbws';

// Function to extract tweet texts
function getTweets() {
  return Array.from(document.getElementsByClassName(tweetClass)).map(tweet => tweet.innerText);
}

// Function to moderate a tweet by sending it to the GPT endpoint
async function moderateTweet(tweet) {
  // console.log('Moderating tweet:', tweet)
  if (await isTweetToxic(tweet)) {
    highlightTweet(tweet);
  }
}

// Function to highlight a tweet in red
function highlightTweet(tweetText) {
  // debugger;
  const tweets = document.getElementsByClassName(tweetClass);
  Array.from(tweets).forEach(tweet => {
    if (tweet.innerText === tweetText) {
      tweet.style.color = 'red';
    }
  });
}

// Function to process all tweets on the page
async function processTweets() {
  const tweets = getTweets();
  await Promise.all(tweets.map(moderateTweet));
}

// Run the function on page load
window.addEventListener('load', processTweets);

// Optional: Run the function periodically to catch dynamically loaded tweets
setInterval(processTweets, 5000);
