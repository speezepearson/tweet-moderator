"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
function getTweetPrefix() {
    return __awaiter(this, void 0, void 0, function* () {
        return chrome.storage.sync.get(['tweetPrefix']).then(({ tweetPrefix }) => tweetPrefix || defaultSettings.tweetPrefix);
    });
}
// END COPYPASTA
function getOpenaiApiKey() {
    return __awaiter(this, void 0, void 0, function* () {
        return chrome.storage.sync.get(['openaiApiKey']).then(({ openaiApiKey }) => openaiApiKey);
    });
}
function hashTweet(tweet) {
    return __awaiter(this, void 0, void 0, function* () {
        const encoder = new TextEncoder();
        const data = encoder.encode(tweet);
        const hashBuffer = yield crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return (tweet.slice(0, 50) + ' ' + hash);
    });
}
function getTweetToxicityCache() {
    return __awaiter(this, void 0, void 0, function* () {
        return chrome.storage.local.get(['tweetToxicity']).then(({ tweetToxicity }) => tweetToxicity || {});
    });
}
function getStoredTweetToxicity(tweet) {
    return __awaiter(this, void 0, void 0, function* () {
        const cache = yield getTweetToxicityCache();
        const cacheKey = yield hashTweet(tweet);
        const info = cache[cacheKey];
        if (info === undefined) {
            return undefined;
        }
        const nYes = info.results.filter(x => x).length;
        const nNo = info.results.length - nYes;
        if (nYes > 1)
            return true;
        if (nNo > 1)
            return false;
        return undefined;
    });
}
function recordTweetToxicity(tweet, isToxic) {
    return __awaiter(this, void 0, void 0, function* () {
        const cache = yield getTweetToxicityCache();
        const cacheKey = yield hashTweet(tweet);
        let cachedInfo = cache[cacheKey];
        if (!cachedInfo) {
            cachedInfo = { lastUpdatedMs: Date.now(), results: [] };
        }
        cachedInfo.results.push(isToxic);
        // while the cache is too big, remove the oldest entry
        while (JSON.stringify(cache).length > 500000) {
            const oldestTweet = Object.entries(cache).reduce((a, b) => a[1].lastUpdatedMs < b[1].lastUpdatedMs ? a : b)[0];
            delete cache[oldestTweet];
        }
        yield chrome.storage.local.set({ tweetToxicity: Object.assign(Object.assign({}, cache), { [cacheKey]: cachedInfo }) });
    });
}
const tweetToxicityCache = new Map();
function isTweetToxic(text) {
    return __awaiter(this, void 0, void 0, function* () {
        const cachedValue = tweetToxicityCache.get(text);
        if (cachedValue !== undefined) {
            return cachedValue;
        }
        const storedValue = yield getStoredTweetToxicity(text);
        if (storedValue !== undefined) {
            return storedValue;
        }
        const openaiApiKey = yield getOpenaiApiKey();
        if (!openaiApiKey)
            return false;
        try {
            console.log('checking', text);
            const response = yield fetch('https://api.openai.com/v1/chat/completions', {
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
                            content: (yield getTweetPrefix()) + text,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                })
            });
            const responseJ = yield response.json();
            const responseText = responseJ.choices[0].message.content;
            const hasGood = responseText.slice(-(maxKeywordLength + 5)).includes(keywords.good);
            const hasBad = responseText.slice(-(maxKeywordLength + 5)).includes(keywords.bad);
            const result = hasBad && !hasGood;
            tweetToxicityCache.set(text, result);
            yield recordTweetToxicity(text, result);
            console.log({ text, responseText, response: responseJ, toxic: result, slice: responseText.slice(-(maxKeywordLength + 5)), bad: keywords.bad });
            return result;
        }
        catch (error) {
            console.error('Error moderating tweet:', error);
            return false;
        }
    });
}
const processedTweets = new Set();
function checkTweet(tweetNode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (processedTweets.has(tweetNode)) {
            return;
        }
        processedTweets.add(tweetNode); // add at beginning rather than end of func to prevent other calls from making API calls for it as well
        if (yield isTweetToxic(tweetNode.innerText)) {
            let parentArticle = getParentArticle(tweetNode);
            if (parentArticle) {
                console.log('removing', tweetNode.innerText);
                parentArticle.style.display = 'none';
            }
        }
    });
}
function getParentArticle(node) {
    let parentArticle = node;
    while (parentArticle && parentArticle.tagName !== 'ARTICLE') {
        parentArticle = parentArticle.parentElement;
    }
    return parentArticle;
}
function isTweetNode(node) {
    return node.getAttribute('data-testid') === 'tweetText';
}
const tweetClass = 'r-8akbws';
function findAndProcessAllTweets() {
    return __awaiter(this, void 0, void 0, function* () {
        const tweets = Array.from(document.getElementsByClassName(tweetClass))
            .filter(t => isTweetNode(t) && t instanceof HTMLElement);
        yield Promise.all(tweets.map(checkTweet));
    });
}
setInterval(findAndProcessAllTweets, 1000);
