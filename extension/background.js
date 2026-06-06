const CACHE_KEY = "tweets_cache";
const STATUS_KEY = "last_attempt";
const PROFILE_URL = "https://x.com/merulox/with_replies";
const AUTO_FETCH_ALARM = "tweet-auto-fetch";
const AUTO_FETCH_MINUTES = 60;
let activeFetch = null;

// Shared ingest secret for the local receiver. Lives in config.local.js (gitignored)
// so it never lands in the repo.
let LOG_INGEST_TOKEN = "";
try {
	importScripts("config.local.js");
	LOG_INGEST_TOKEN = self.LOG_INGEST_TOKEN || "";
} catch {
	// config.local.js absent — local receiver pushes are disabled until it's added.
}
// Local receiver (log-ingest-receiver, a systemd --user service). Fully local —
// ChatGPT titles never leave the machine.
const CHATGPT_INGEST_URL = "http://localhost:47832/chatgpt";
const CHATGPT_STATUS_KEY = "chatgpt_status";
const TWEETS_INGEST_URL = "http://localhost:47832/tweets";
const PUSH_STATUS_KEY = "push_status";

// Injected into a hidden replies-inclusive profile tab.
async function scrapeAndStore() {
  const SCREEN_NAME = "merulox";
  const TARGET_COUNT = 30;
  const tweets = new Map();

  function replyMetadata(article) {
    const context = article.innerText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("Replying to"));

    if (!context) return {};

    return {
      isReply: true,
      replyTo: context.replace(/^Replying to\s*/i, "").trim(),
    };
  }

  function collectVisibleTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    for (const article of articles) {
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const timeEl = article.querySelector("time");
      const linkEl = timeEl?.closest(`a[href*="/${SCREEN_NAME}/status/"]`)
        ?? article.querySelector(`a[href*="/${SCREEN_NAME}/status/"]`);
      if (!textEl || !linkEl) continue;
      const href = linkEl.getAttribute("href")?.split("?")[0];
      const author = href?.match(/^\/([^/]+)\/status\//)?.[1];
      const url = `https://x.com${href}`;
      tweets.set(url, {
        text: textEl.textContent.trim(),
        timestamp: timeEl?.getAttribute("datetime") ?? null,
        url,
        author: author ? `@${author}` : `@${SCREEN_NAME}`,
        ...replyMetadata(article),
      });
    }
  }

  let unchangedRounds = 0;
  let previousCount = 0;
  for (let round = 0; round < 45 && tweets.size < TARGET_COUNT && unchangedRounds < 7; round += 1) {
    collectVisibleTweets();
    unchangedRounds = tweets.size === previousCount ? unchangedRounds + 1 : 0;
    previousCount = tweets.size;
    window.scrollBy(0, Math.max(window.innerHeight * 0.85, 700));
    await new Promise((resolve) => setTimeout(resolve, 1400));
  }
  collectVisibleTweets();

  return Array.from(tweets.values()).slice(0, TARGET_COUNT);
}

async function runFetchViaTab() {
  // Always use a disposable hidden tab so collection never scrolls the user's tab.
  const tab = await chrome.tabs.create({ url: PROFILE_URL, active: false });
  const tabId = tab.id;
  await new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
  // Give React time to render the first timeline rows.
  await new Promise((r) => setTimeout(r, 2500));

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

    const pushed = await pushTweetsToReceiver(tweets);
    return { ok: true, tweets, pushed };
  } catch (err) {
    await chrome.storage.local.set({
      [STATUS_KEY]: { ok: false, time: Date.now(), count: 0, error: err.message, source: "dom" },
    });
    return { ok: false, error: err.message };
  } finally {
    chrome.tabs.remove(tabId);
  }
}

function fetchViaTab() {
  if (!activeFetch) {
    activeFetch = runFetchViaTab().finally(() => {
      activeFetch = null;
    });
  }
  return activeFetch;
}

async function ensureAutoFetchAlarm() {
  const alarm = await chrome.alarms.get(AUTO_FETCH_ALARM);
  if (!alarm) {
    chrome.alarms.create(AUTO_FETCH_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: AUTO_FETCH_MINUTES,
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAutoFetchAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAutoFetchAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_FETCH_ALARM) fetchViaTab();
});

ensureAutoFetchAlarm();

async function pushTweetsToReceiver(tweets) {
  const status = { time: Date.now(), count: tweets?.length ?? 0 };
  try {
    if (!LOG_INGEST_TOKEN) throw new Error("no ingest token — add config.local.js");
    if (!tweets?.length) throw new Error("no tweets returned");

    const res = await fetch(TWEETS_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOG_INGEST_TOKEN}`,
      },
      body: JSON.stringify({ tweets }),
    });
    if (!res.ok) throw new Error(`ingest ${res.status}`);

    await chrome.storage.local.set({ [PUSH_STATUS_KEY]: { ...status, ok: true, error: null } });
    return { ok: true };
  } catch (err) {
    await chrome.storage.local.set({ [PUSH_STATUS_KEY]: { ...status, ok: false, error: err.message } });
    return { ok: false, error: err.message };
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
  if (msg.action === "pushTweets") {
    pushTweetsToReceiver(msg.tweets).then(sendResponse);
    return true;
  }
  if (msg.action === "chatgptHistory") {
    pushChatgpt(msg).then(sendResponse);
    return true;
  }
});
