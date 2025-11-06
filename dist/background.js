"use strict";
(() => {
  // src/background.ts
  chrome.runtime.onInstalled.addListener(() => {
    console.log("Tweet Moderator extension installed");
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && (tab.url.includes("x.com") || tab.url.includes("twitter.com"))) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    }
  });
})();
//# sourceMappingURL=background.js.map
