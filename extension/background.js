const CACHE_KEY = "tweets_cache";
const STATUS_KEY = "last_attempt";
const PROFILE_URL = "https://x.com/merulox/with_replies";
const AUTO_FETCH_ALARM = "tweet-auto-fetch";
const AUTO_FETCH_MINUTES = 60;
const THREAD_RESOLVER_VERSION = 3;
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

  const timeline = Array.from(tweets.values()).slice(0, TARGET_COUNT);
  for (let index = 1; index < timeline.length; index += 1) {
    const parent = timeline[index - 1];
    const current = timeline[index];
    const parentTime = Date.parse(parent.timestamp);
    const currentTime = Date.parse(current.timestamp);
    const elapsed = currentTime - parentTime;

    // X displays self-thread continuations directly after their parent in
    // ascending time order. Normal timeline rows remain newest-first.
    if (elapsed > 0 && elapsed <= 24 * 60 * 60 * 1000) {
      current.threadResolved = true;
      current.threadVersion = THREAD_RESOLVER_VERSION;
      current.isReply = true;
      current.replyTo = parent.author;
      current.replyToUrl = parent.url;
    }
  }

  return timeline;
}

function inspectThread(currentUrl) {
  const currentPath = new URL(currentUrl).pathname;
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const focalIndex = articles.findIndex((article) => {
    const time = article.querySelector("time");
    const href = time?.closest('a[href*="/status/"]')?.getAttribute("href")?.split("?")[0];
    return href === currentPath;
  });

  if (focalIndex < 0) return { threadResolved: false };

  const focal = articles[focalIndex];
  const context = focal.innerText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("Replying to"));
  const replyThread = articles
    .slice(Math.max(0, focalIndex - 5), focalIndex)
    .map((article) => {
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const timeEl = article.querySelector("time");
      const href = timeEl?.closest('a[href*="/status/"]')?.getAttribute("href")?.split("?")[0];
      const author = href?.match(/^\/([^/]+)\/status\//)?.[1];
      if (!textEl || !href) return null;
      return {
        text: textEl.textContent.trim(),
        timestamp: timeEl?.getAttribute("datetime") ?? null,
        url: `https://x.com${href}`,
        author: author ? `@${author}` : null,
      };
    })
    .filter(Boolean);
  const parent = replyThread.at(-1);

  if (!parent && !context) return { threadResolved: true, threadVersion: 3 };

  return {
    threadResolved: true,
    threadVersion: 3,
    isReply: true,
    ...(parent?.author ? { replyTo: parent.author } : {}),
    ...(context && !parent?.author ? { replyTo: context.replace(/^Replying to\s*/i, "").trim() } : {}),
    ...(parent?.url ? { replyToUrl: parent.url } : {}),
    ...(replyThread.length ? { replyThread } : {}),
  };
}

function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
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
    }, timeoutMs);
  });
}

async function resolveThreads(tabId, tweets) {
  const cached = await chrome.storage.local.get(CACHE_KEY);
  const cachedByUrl = new Map((cached[CACHE_KEY]?.tweets ?? []).map((tweet) => [tweet.url, tweet]));
  const resolved = [];

  for (const tweet of tweets) {
    if (tweet.threadResolved && tweet.threadVersion === THREAD_RESOLVER_VERSION) {
      resolved.push(tweet);
      continue;
    }

    const prior = cachedByUrl.get(tweet.url);
    if (prior?.threadResolved && prior.threadVersion === THREAD_RESOLVER_VERSION) {
      resolved.push({
        ...tweet,
        threadResolved: true,
        threadVersion: THREAD_RESOLVER_VERSION,
        ...(prior.isReply ? {
          isReply: true,
          replyTo: prior.replyTo,
          replyToUrl: prior.replyToUrl,
          replyThread: prior.replyThread,
        } : {}),
      });
      continue;
    }

    try {
      const loaded = waitForTabLoad(tabId);
      await chrome.tabs.update(tabId, { url: tweet.url });
      await loaded;
      let metadata = { threadResolved: false };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: inspectThread,
          args: [tweet.url],
        });
        metadata = result?.[0]?.result ?? metadata;
        if (metadata.isReply) break;
      }
      resolved.push({ ...tweet, ...metadata });
    } catch {
      resolved.push({ ...tweet, threadResolved: false });
    }
  }

  return resolved;
}

async function runFetchViaTab() {
  // Always use a disposable hidden tab so collection never scrolls the user's tab.
  const tab = await chrome.tabs.create({ url: PROFILE_URL, active: false });
  const tabId = tab.id;
  await waitForTabLoad(tabId);
  // Give React time to render the first timeline rows.
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeAndStore,
    });

    const timelineTweets = results?.[0]?.result ?? [];

    if (timelineTweets.length === 0) throw new Error("No tweets found in DOM — page may not have loaded");
    const tweets = await resolveThreads(tabId, timelineTweets);

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
