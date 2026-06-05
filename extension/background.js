const CACHE_KEY = "tweets_cache";
const STATUS_KEY = "last_attempt";
const PROFILE_URL = "https://x.com/merulox";

// Shared ingest secret for the ChatGPT bridge. Lives in config.local.js (gitignored)
// so it never lands in the repo. Must match LOG_KV_TOKEN on Cloudflare Pages.
let LOG_INGEST_TOKEN = "";
try {
	importScripts("config.local.js");
	LOG_INGEST_TOKEN = self.LOG_INGEST_TOKEN || "";
} catch {
	// config.local.js absent — ChatGPT bridge disabled until it's added.
}
// Local receiver (log-ingest-receiver, a systemd --user service). Fully local —
// ChatGPT titles never leave the machine.
const CHATGPT_INGEST_URL = "http://localhost:47832/chatgpt";
const CHATGPT_STATUS_KEY = "chatgpt_status";

// Injected into an x.com/merulox tab by "Fetch now"
function scrapeAndStore() {
  const SCREEN_NAME = "merulox";
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];

  for (const article of articles) {
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const timeEl = article.querySelector("time");
    const linkEl = article.querySelector(`a[href*="/${SCREEN_NAME}/status/"]`);
    if (!textEl || !linkEl) continue;
    tweets.push({
      text: textEl.textContent.trim(),
      date: timeEl?.getAttribute("datetime")?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
      url: `https://x.com${linkEl.getAttribute("href")}`,
    });
  }

  return tweets;
}

async function fetchViaTab() {
  // Find an existing x.com/merulox tab
  const tabs = await chrome.tabs.query({ url: "https://x.com/merulox*" });
  let tabId;
  let opened = false;

  if (tabs.length > 0) {
    tabId = tabs[0].id;
  } else {
    // Open the profile page, wait for it to load
    const tab = await chrome.tabs.create({ url: PROFILE_URL, active: false });
    tabId = tab.id;
    opened = true;
    await new Promise((resolve) => {
      const listener = (id, info) => {
        if (id === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    // Give React time to render tweets
    await new Promise((r) => setTimeout(r, 2500));
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeAndStore,
    });

    const tweets = results?.[0]?.result ?? [];

    if (tweets.length === 0) throw new Error("No tweets found in DOM — page may not have loaded");

    await chrome.storage.local.set({
      [CACHE_KEY]: { tweets, fetchedAt: Date.now() },
      [STATUS_KEY]: { ok: true, time: Date.now(), count: tweets.length, error: null, source: "dom" },
    });

    return { ok: true, tweets };
  } catch (err) {
    await chrome.storage.local.set({
      [STATUS_KEY]: { ok: false, time: Date.now(), count: 0, error: err.message, source: "dom" },
    });
    return { ok: false, error: err.message };
  } finally {
    if (opened) chrome.tabs.remove(tabId);
  }
}

// Receive ChatGPT history harvested by the content script and push it to the bridge.
async function pushChatgpt(msg) {
  const status = { time: Date.now(), count: msg.items?.length ?? 0 };
  try {
    if (msg.error) throw new Error(msg.error);
    if (!LOG_INGEST_TOKEN) throw new Error("no ingest token — add config.local.js");
    if (!msg.items?.length) throw new Error("no conversations returned");

    const res = await fetch(CHATGPT_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOG_INGEST_TOKEN}`,
      },
      body: JSON.stringify({ items: msg.items }),
    });
    if (!res.ok) throw new Error(`ingest ${res.status}`);

    await chrome.storage.local.set({ [CHATGPT_STATUS_KEY]: { ...status, ok: true, error: null } });
    return { ok: true };
  } catch (err) {
    await chrome.storage.local.set({ [CHATGPT_STATUS_KEY]: { ...status, ok: false, error: err.message } });
    return { ok: false, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "fetchTweets") {
    fetchViaTab().then(sendResponse);
    return true;
  }
  if (msg.action === "chatgptHistory") {
    pushChatgpt(msg).then(sendResponse);
    return true;
  }
});
