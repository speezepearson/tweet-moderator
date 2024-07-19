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
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('settings-form');
    if (!form)
        return;
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
