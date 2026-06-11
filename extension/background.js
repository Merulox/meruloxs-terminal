const CACHE_KEY = "tweets_cache";
const STATUS_KEY = "last_attempt";
const OBSERVED_KEY = "tweets_observed";
const PROFILE_URL = "https://x.com/merulox/with_replies";
const AUTO_FETCH_ALARM = "tweet-auto-fetch";
const AUTO_FETCH_MINUTES = 60;
const THREAD_RESOLVER_VERSION = 5;
const LOG_KEY = "tweet_seeder_logs";
const LOG_LIMIT = 60;
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
const LIVE_TWEETS_INGEST_URL = "https://merulox.com/api/tweets";
const PUSH_STATUS_KEY = "push_status";
const EASTERN_TIME_ZONE = "America/New_York";
const TWEET_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
	timeZone: EASTERN_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});
const TWEET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
	timeZone: EASTERN_TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

function toEasternDate(isoTimestamp) {
	if (!isoTimestamp) return null;
	const date = new Date(isoTimestamp);
	if (Number.isNaN(date.getTime())) return null;
	const parts = TWEET_DATE_FORMATTER.formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	if (!year || !month || !day) return null;
	return `${year}-${month}-${day}`;
}

function toEasternTime(isoTimestamp) {
	if (!isoTimestamp) return null;
	const date = new Date(isoTimestamp);
	if (Number.isNaN(date.getTime())) return null;
	return TWEET_TIME_FORMATTER.format(date);
}

function normalizeLogValue(value, depth = 0) {
	if (value == null) return value;
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
		};
	}
	if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 497)}…` : value;
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (depth >= 2) return Array.isArray(value) ? `[array:${value.length}]` : "[object]";
	if (Array.isArray(value)) return value.slice(0, 8).map((item) => normalizeLogValue(item, depth + 1));
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.slice(0, 12)
				.map(([key, entry]) => [key, normalizeLogValue(entry, depth + 1)]),
		);
	}
	return String(value);
}

async function appendLog(level, scope, message, detail = null) {
	const entry = {
		time: Date.now(),
		level,
		scope,
		message,
		...(detail != null ? { detail: normalizeLogValue(detail) } : {}),
	};
	try {
		const data = await chrome.storage.local.get(LOG_KEY);
		const logs = Array.isArray(data[LOG_KEY]) ? data[LOG_KEY] : [];
		logs.unshift(entry);
		await chrome.storage.local.set({ [LOG_KEY]: logs.slice(0, LOG_LIMIT) });
	} catch {
		// Logging should never break the fetch path.
	}
}

const log = {
	info: (scope, message, detail) => appendLog("info", scope, message, detail),
	warn: (scope, message, detail) => appendLog("warn", scope, message, detail),
	error: (scope, message, detail) => appendLog("error", scope, message, detail),
};

// Injected into a hidden replies-inclusive profile tab.
async function scrapeAndStore() {
	const SCREEN_NAME = "merulox";
	const TARGET_COUNT = 30;
	const THREAD_VERSION = 5;
	const tweets = new Map();
	const debug = {
		url: location.href,
		rounds: 0,
		initial: { articles: 0, timeEls: 0, tweetTextEls: 0, tweetAnchors: 0 },
		lastSample: null,
		collectionErrors: [],
	};

	function easternDate(isoTimestamp) {
		if (!isoTimestamp) return null;
		const date = new Date(isoTimestamp);
		if (Number.isNaN(date.getTime())) return null;
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: "America/New_York",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(date);
		const value = (type) => parts.find((part) => part.type === type)?.value;
		return `${value("year")}-${value("month")}-${value("day")}`;
	}

	function captureDomStats() {
		const articles = document.querySelectorAll("article").length;
		const timeEls = document.querySelectorAll("time").length;
		const tweetTextEls = document.querySelectorAll('[data-testid="tweetText"], div[lang], span[lang]').length;
		const tweetAnchors = document.querySelectorAll(`a[href*="/${SCREEN_NAME}/status/"]`).length;
		return { articles, timeEls, tweetTextEls, tweetAnchors };
	}

	function collectVisibleTweets() {
		const articles = document.querySelectorAll("article");
		for (const article of articles) {
			try {
				const timeEl = article.querySelector("time");
				const textEl = article.querySelector('[data-testid="tweetText"], div[lang], span[lang]');
				const linkEl = timeEl?.closest(`a[href*="/${SCREEN_NAME}/status/"]`)
					?? article.querySelector(`a[href*="/${SCREEN_NAME}/status/"]`);
				if (!timeEl || !textEl || !linkEl) continue;
				const href = linkEl.getAttribute("href")?.split("?")[0];
				const text = textEl.textContent?.trim();
				if (!href || !text) continue;
				const timestamp = timeEl?.getAttribute("datetime") ?? null;
				const author = href.match(/^\/([^/]+)\/status\//)?.[1];
				const url = `https://x.com${href}`;
				const replyContext = article.innerText
					.split("\n")
					.map((line) => line.trim())
					.find((line) => line.startsWith("Replying to"));
				tweets.set(url, {
					text,
					date: easternDate(timestamp),
					timestamp,
					url,
					author: author ? `@${author}` : `@${SCREEN_NAME}`,
					...(replyContext ? {
						isReply: true,
						replyTo: replyContext.replace(/^Replying to\s*/i, "").trim(),
					} : {}),
				});
			} catch (error) {
				if (debug.collectionErrors.length < 5) {
					debug.collectionErrors.push(String(error?.message ?? error));
				}
			}
		}
	}

	let unchangedRounds = 0;
	let previousCount = 0;
	for (let round = 0; round < 45 && tweets.size < TARGET_COUNT && unchangedRounds < 7; round += 1) {
		if (round === 0) debug.initial = captureDomStats();
		collectVisibleTweets();
		unchangedRounds = tweets.size === previousCount ? unchangedRounds + 1 : 0;
		previousCount = tweets.size;
		debug.rounds = round + 1;
		debug.lastSample = captureDomStats();
		window.scrollBy(0, Math.max(window.innerHeight * 0.85, 700));
		await new Promise((resolve) => setTimeout(resolve, 1400));
	}
	collectVisibleTweets();
	debug.lastSample = captureDomStats();

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
			current.threadVersion = THREAD_VERSION;
			current.isReply = true;
			current.replyTo = parent.author;
			current.replyToUrl = parent.url;
		}
	}

	return { tweets: timeline, debug };
}

function inspectThread(currentUrl) {
	window.scrollTo(0, 0);
	function easternDate(isoTimestamp) {
		if (!isoTimestamp) return null;
		const date = new Date(isoTimestamp);
		if (Number.isNaN(date.getTime())) return null;
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: "America/New_York",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(date);
		const value = (type) => parts.find((part) => part.type === type)?.value;
		return `${value("year")}-${value("month")}-${value("day")}`;
	}

	const currentPath = new URL(currentUrl).pathname;
	const articles = Array.from(document.querySelectorAll("article"));
	const focalIndex = articles.findIndex((article) => {
		const time = article.querySelector("time");
		const href = time?.closest('a[href*="/status/"]')?.getAttribute("href")?.split("?")[0];
		return href === currentPath;
	});

	if (focalIndex < 0) return { threadResolved: false };

	const focal = articles[focalIndex];
	const focalTime = Date.parse(focal.querySelector("time")?.getAttribute("datetime") ?? "");
	const context = focal.innerText
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.startsWith("Replying to"));
	const replyThread = articles
		.map((article) => {
			const timeEl = article.querySelector("time");
			const textEl = article.querySelector('[data-testid="tweetText"], div[lang], span[lang]');
			const href = timeEl?.closest('a[href*="/status/"]')?.getAttribute("href")?.split("?")[0];
			const author = href?.match(/^\/([^/]+)\/status\//)?.[1];
			const timestamp = timeEl?.getAttribute("datetime") ?? null;
			if (!textEl || !href || href === currentPath) return null;
			return {
				text: textEl.textContent?.trim() ?? "",
				date: easternDate(timestamp),
				timestamp,
				url: `https://x.com${href}`,
				author: author ? `@${author}` : null,
			};
		})
		.filter((post) => post && Date.parse(post.timestamp) <= focalTime)
		.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
		.slice(-5);
	const parent = replyThread.at(-1);

	if (!parent && !context) return { threadResolved: true, threadVersion: 5 };

	return {
		threadResolved: true,
		threadVersion: 5,
		isReply: true,
		...(parent?.author ? { replyTo: parent.author } : {}),
		...(context && !parent?.author ? { replyTo: context.replace(/^Replying to\s*/i, "").trim() } : {}),
		...(parent?.url ? { replyToUrl: parent.url } : {}),
		...(replyThread.length ? { replyThread } : {}),
	};
}

function probeProfilePage(screenName) {
	const articles = document.querySelectorAll("article");
	const timeEls = document.querySelectorAll("time");
	const tweetTextEls = document.querySelectorAll('[data-testid="tweetText"], div[lang], span[lang]');
	const tweetAnchors = document.querySelectorAll(`a[href*="/${screenName}/status/"]`);
	return {
		url: location.href,
		visibility: document.visibilityState,
		readyState: document.readyState,
		articles: articles.length,
		timeEls: timeEls.length,
		tweetTextEls: tweetTextEls.length,
		tweetAnchors: tweetAnchors.length,
		scrollHeight: document.documentElement.scrollHeight,
		innerHeight: window.innerHeight,
	};
}

async function resolveThreadViaApi(tweetUrl) {
  const statusId = new URL(tweetUrl).pathname.match(/\/status\/(\d+)/)?.[1];
  if (!statusId) return null;

  const response = await fetch(`https://api.fxtwitter.com/status/${statusId}`);
  if (!response.ok) return null;

  const current = (await response.json()).tweet;
  if (!current?.replying_to_status) {
    return { threadResolved: true, threadVersion: THREAD_RESOLVER_VERSION };
  }

  const replyThread = [];
  let parentId = current.replying_to_status;
  for (let depth = 0; depth < 5 && parentId; depth += 1) {
    const parentResponse = await fetch(`https://api.fxtwitter.com/status/${parentId}`);
    if (!parentResponse.ok) break;
    const parent = (await parentResponse.json()).tweet;
    if (!parent?.id || !parent.text || !parent.author?.screen_name) break;

		replyThread.unshift({
			text: parent.text,
			date: toEasternDate(parent.created_at),
			timestamp: parent.created_at ? new Date(parent.created_at).toISOString() : null,
			url: parent.url,
			author: `@${parent.author.screen_name}`,
		});
    parentId = parent.replying_to_status;
  }

  const immediateParent = replyThread.at(-1);
  return {
    threadResolved: true,
    threadVersion: THREAD_RESOLVER_VERSION,
    isReply: true,
    replyTo: immediateParent?.author ?? `@${current.replying_to}`,
    ...(immediateParent?.url ? { replyToUrl: immediateParent.url } : {}),
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
			const apiMetadata = await resolveThreadViaApi(tweet.url);
			if (apiMetadata) {
				resolved.push({ ...tweet, ...apiMetadata });
				continue;
			}
		} catch {
			// Fall through to X's rendered permalink when public metadata is unavailable.
		}

		try {
			const loaded = waitForTabLoad(tabId);
			await chrome.tabs.update(tabId, { url: tweet.url });
			await loaded;
			let metadata = { threadResolved: false };
			let standaloneObservations = 0;
			for (let attempt = 0; attempt < 10; attempt += 1) {
				await new Promise((resolve) => setTimeout(resolve, 1500));
				const result = await chrome.scripting.executeScript({
					target: { tabId },
					func: inspectThread,
					args: [tweet.url],
				});
				metadata = result?.[0]?.result ?? metadata;
				// X often renders "Replying to" before it inserts the parent article.
				// It can also render the focal post before either signal, so require
				// repeated standalone observations before accepting that classification.
				if (metadata.replyThread?.length) break;
				if (!metadata.isReply && metadata.threadResolved) {
					standaloneObservations += 1;
					if (standaloneObservations >= 4) break;
				}
			}
			resolved.push({ ...tweet, ...metadata });
		} catch {
			resolved.push({ ...tweet, threadResolved: false });
		}
	}

	return resolved;
}

async function mergeObservedTweets(scrapedTweets) {
	const stored = await chrome.storage.local.get(OBSERVED_KEY);
	const observedTweets = stored[OBSERVED_KEY]?.tweets ?? [];
	const merged = new Map();

	for (const tweet of [...scrapedTweets, ...observedTweets]) {
		if (!tweet?.url || !tweet?.text) continue;
		const prior = merged.get(tweet.url);
		merged.set(tweet.url, {
			...(prior ?? {}),
			...tweet,
			text: tweet.text,
			timestamp: tweet.timestamp ?? prior?.timestamp ?? null,
			date: tweet.date ?? prior?.date ?? null,
		});
	}

	const timestamp = (tweet) => {
		const value = Date.parse(tweet.timestamp);
		return Number.isNaN(value) ? 0 : value;
	};

	return {
		tweets: Array.from(merged.values())
			.sort((a, b) => timestamp(b) - timestamp(a))
			.slice(0, 100),
		observedCount: observedTweets.length,
		observedAt: stored[OBSERVED_KEY]?.updatedAt ?? null,
	};
}

async function runFetchViaTab() {
	// Always use a disposable hidden tab so collection never scrolls the user's tab.
	const [previousActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
	const tab = await chrome.tabs.create({ url: PROFILE_URL, active: false });
	const tabId = tab.id;
	await log.info("fetch", "opened profile tab", { url: PROFILE_URL });
	await waitForTabLoad(tabId);
	// Give React time to render the first timeline rows.
	await new Promise((r) => setTimeout(r, 2500));
	let probe = null;

	try {
		const initialProbe = await chrome.scripting.executeScript({
			target: { tabId },
			func: probeProfilePage,
			args: ["merulox"],
		});
		probe = initialProbe?.[0]?.result ?? null;
		await log.info("probe", "profile page state", probe);

		if (!probe?.articles && previousActiveTab?.id != null) {
			await log.warn("probe", "hidden tab looks inert; reactivating profile tab", probe);
			await chrome.tabs.update(tabId, { active: true });
			await new Promise((r) => setTimeout(r, 2000));
			const reactivatedProbe = await chrome.scripting.executeScript({
				target: { tabId },
				func: probeProfilePage,
				args: ["merulox"],
			});
			probe = reactivatedProbe?.[0]?.result ?? probe;
			await log.info("probe", "profile page after activation", probe);
		}

		const results = await chrome.scripting.executeScript({
			target: { tabId },
			func: scrapeAndStore,
		});
		const injectionResult = results?.[0] ?? null;
		const scrapeResult = injectionResult?.result ?? {};
		const scrapedTweets = Array.isArray(scrapeResult) ? scrapeResult : scrapeResult.tweets ?? [];
		const mergedTimeline = await mergeObservedTweets(scrapedTweets);
		const timelineTweets = mergedTimeline.tweets;
		await log.info("scrape", "completed DOM scrape", {
			count: timelineTweets.length,
			scrapedCount: scrapedTweets.length,
			observedCount: mergedTimeline.observedCount,
			observedAt: mergedTimeline.observedAt,
			debug: scrapeResult.debug ?? null,
			probe,
			injectionKeys: injectionResult ? Object.keys(injectionResult) : [],
			resultType: Array.isArray(injectionResult?.result) ? "array" : typeof injectionResult?.result,
		});

		if (timelineTweets.length === 0) {
			await log.warn("scrape", "no tweets found in DOM", {
				scrape: scrapeResult.debug ?? null,
				probe,
			});
			throw new Error(`No tweets found in DOM — ${probe?.visibility ?? "unknown"} ${probe?.articles ?? 0} articles ${probe?.tweetTextEls ?? 0} text nodes`);
		}
		const tweets = await resolveThreads(tabId, timelineTweets);
		await log.info("resolve", "thread resolution finished", {
			count: tweets.length,
			replies: tweets.filter((tweet) => tweet.isReply).length,
		});

    await chrome.storage.local.set({
      [CACHE_KEY]: { tweets, fetchedAt: Date.now() },
      [STATUS_KEY]: { ok: true, time: Date.now(), count: tweets.length, error: null, source: "dom" },
    });

		const pushed = await pushTweetsToReceiver(tweets);
		if (!pushed.ok) {
			await log.error("push", "receiver rejected tweets", pushed.error || "unknown error");
			throw new Error(pushed.error || "tweet ingest failed");
		}
		await log.info("push", "receiver accepted tweets", { count: tweets.length });
		return { ok: true, tweets, pushed };
  } catch (err) {
    await log.error("fetch", "fetch failed", err);
    await chrome.storage.local.set({
      [STATUS_KEY]: { ok: false, time: Date.now(), count: 0, error: err.message, source: "dom" },
    });
    return { ok: false, error: err.message };
  } finally {
		if (previousActiveTab?.id != null && previousActiveTab.id !== tabId) {
			try {
				await chrome.tabs.update(previousActiveTab.id, { active: true });
			} catch {
				// Best effort restoration only.
			}
		}
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

    const body = JSON.stringify({ tweets });
    const push = (url) => fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${LOG_INGEST_TOKEN}`,
		},
		body,
	});
	const [local, live] = await Promise.allSettled([
		push(TWEETS_INGEST_URL),
		push(LIVE_TWEETS_INGEST_URL),
	]);
	const failures = [];
	for (const [name, result] of [["local", local], ["live", live]]) {
		if (result.status === "rejected") failures.push(`${name}: ${result.reason?.message ?? result.reason}`);
		else if (!result.value.ok) failures.push(`${name}: ${result.value.status} ${await result.value.text()}`);
	}
	if (failures.length) throw new Error(failures.join(" · "));

    await chrome.storage.local.set({ [PUSH_STATUS_KEY]: { ...status, ok: true, error: null } });
    return { ok: true };
  } catch (err) {
    await log.error("push", "push to receiver failed", err);
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
    await log.info("chatgpt", "chatgpt history pushed", { count: status.count });
    return { ok: true };
  } catch (err) {
    await log.error("chatgpt", "chatgpt push failed", err);
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
