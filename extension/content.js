// Runs on merulox.com — bridges chrome.storage → page localStorage
const LS_KEY = "merulox_tweets_v1";
const STALE_MS = 60 * 60 * 1000;

function lsAge() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return Infinity;
    return Date.now() - JSON.parse(raw).fetchedAt;
  } catch {
    return Infinity;
  }
}

async function sync() {
  // Check if chrome.storage has fresher data than localStorage
  const { tweets_cache } = await chrome.storage.local.get("tweets_cache");
  if (!tweets_cache?.tweets?.length) return;

  const storageAge = Date.now() - tweets_cache.fetchedAt;
  if (storageAge < lsAge()) {
    localStorage.setItem(LS_KEY, JSON.stringify(tweets_cache));
    window.dispatchEvent(new CustomEvent("tweetsUpdated"));
  }

  // If localStorage is now stale, ask background for a fresh fetch
  if (storageAge > STALE_MS) {
    chrome.runtime.sendMessage({ action: "fetchTweets" }, () => {});
  }
}

sync();
