const CACHE_KEY = "tweets_cache";
const STATUS_KEY = "last_attempt";
const OBSERVED_KEY = "tweets_observed";
const PROFILE_URL = "https://x.com/merulox/with_replies";
const AUTO_FETCH_ALARM = "tweet-auto-fetch";
const AUTO_FETCH_MINUTES = 60;
const DELETE_RETRY_ALARM = "tweet-delete-retry";
const DELETE_RETRY_MINUTES = 5;
const THREAD_RESOLVER_VERSION = 6;
const DELETE_QUEUE_KEY = "tweet_delete_queue";
const RECONCILE_KEY = "tweet_reconcile_evidence";
const RECENT_RECONCILE_DAYS = 7;
const MAX_RECONCILE_PER_FETCH = 5;
const LOG_KEY = "tweet_seeder_logs";
const LOG_LIMIT = 60;
let activeFetch = null;
let activeMutation = Promise.resolve();
let activeDeleteProcess = null;

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
const DELETE_STATUS_KEY = "delete_status";
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
				const media = Array.from(article.querySelectorAll('img[src*="pbs.twimg.com/media"]'))
					.map((img) => {
						const src = img.getAttribute("src") || "";
						const mediaUrl = new URL(src);
						mediaUrl.searchParams.set("format", "jpg");
						mediaUrl.searchParams.set("name", "medium");
						return mediaUrl.toString();
					})
					.filter((value, index, values) => values.indexOf(value) === index);
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
					...(media.length ? { media } : {}),
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

	return { tweets: Array.from(tweets.values()).slice(0, TARGET_COUNT), debug };
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
	if (!context) return { threadResolved: true, threadVersion: 6 };

	const replyThread = articles
		.slice(0, focalIndex)
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

	if (!parent) return { threadResolved: false };

	return {
		threadResolved: true,
		threadVersion: 6,
		isReply: true,
		replyTo: parent.author ?? context.replace(/^Replying to\s*/i, "").trim(),
		replyToUrl: parent.url,
		...(replyThread.length ? { replyThread } : {}),
	};
}

function inspectPostAvailability(currentUrl) {
	const currentPath = new URL(currentUrl).pathname;
	const focalExists = Array.from(document.querySelectorAll("article")).some((article) => {
		const href = article.querySelector("time")?.closest('a[href*="/status/"]')?.getAttribute("href")?.split("?")[0];
		return href === currentPath;
	});
	if (focalExists) return { available: true, unavailable: false };

	const text = document.body?.innerText ?? "";
	const unavailable = [
		"This Post was deleted by the Post author",
		"This post was deleted by the post author",
		"Hmm...this page doesn’t exist",
		"Hmm...this page doesn't exist",
	].some((message) => text.includes(message));
	return { available: false, unavailable };
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
    return {
      threadResolved: true,
      threadVersion: THREAD_RESOLVER_VERSION,
      isReply: false,
      replyTo: null,
      replyToUrl: null,
      replyThread: null,
    };
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
  const replyTo = immediateParent?.author ?? (current.replying_to ? `@${current.replying_to}` : null);
  const replyToUrl = immediateParent?.url
    ?? (current.replying_to ? `https://x.com/${current.replying_to}/status/${current.replying_to_status}` : null);
  if (!replyToUrl) return null;
  return {
    threadResolved: true,
    threadVersion: THREAD_RESOLVER_VERSION,
    isReply: true,
    ...(replyTo ? { replyTo } : {}),
    replyToUrl,
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

function serializeMutation(task) {
	const run = activeMutation.then(task, task);
	activeMutation = run.catch(() => {});
	return run;
}

async function reconcileMissingTweets(tabId, scrapedTweets) {
	const cached = await chrome.storage.local.get([CACHE_KEY, RECONCILE_KEY]);
	const scrapedUrls = new Set(scrapedTweets.map((tweet) => tweet.url));
	const cutoff = Date.now() - RECENT_RECONCILE_DAYS * 24 * 60 * 60 * 1000;
	const evidence = { ...(cached[RECONCILE_KEY] ?? {}) };
	for (const [url, item] of Object.entries(evidence)) {
		if ((item?.lastObservedAt ?? 0) < Date.now() - 14 * 24 * 60 * 60 * 1000) delete evidence[url];
	}
	const candidates = (cached[CACHE_KEY]?.tweets ?? [])
		.filter((tweet) => !scrapedUrls.has(tweet.url) && Date.parse(tweet.timestamp ?? 0) >= cutoff)
		.slice(0, MAX_RECONCILE_PER_FETCH);
	const removed = [];

	for (const tweet of candidates) {
		const loaded = waitForTabLoad(tabId);
		await chrome.tabs.update(tabId, { url: tweet.url });
		await loaded;
		await new Promise((resolve) => setTimeout(resolve, 1800));
		const result = await chrome.scripting.executeScript({
			target: { tabId },
			func: inspectPostAvailability,
			args: [tweet.url],
		});
		const availability = result?.[0]?.result;
		if (availability?.available) {
			delete evidence[tweet.url];
			continue;
		}
		if (!availability?.unavailable) continue;
		const observations = (evidence[tweet.url]?.observations ?? 0) + 1;
		evidence[tweet.url] = { observations, lastObservedAt: Date.now() };
		if (observations >= 3) {
			await enqueueTombstone(tweet.url, "x-reconcile");
			removed.push(tweet.url);
			delete evidence[tweet.url];
		}
	}
	await chrome.storage.local.set({ [RECONCILE_KEY]: evidence });
	if (removed.length) await processDeleteQueue();
	return removed;
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
				} : {
					isReply: false,
					replyTo: null,
					replyToUrl: null,
					replyThread: null,
				}),
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
		const reconciledDeletes = await reconcileMissingTweets(tabId, scrapedTweets);
		const mergedTimeline = await mergeObservedTweets(scrapedTweets);
		const deletedUrls = new Set(reconciledDeletes);
		const timelineTweets = mergedTimeline.tweets.filter((tweet) => !deletedUrls.has(tweet.url));
		await log.info("scrape", "completed DOM scrape", {
			count: timelineTweets.length,
			scrapedCount: scrapedTweets.length,
			observedCount: mergedTimeline.observedCount,
			observedAt: mergedTimeline.observedAt,
			reconciledDeletes,
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
		if (!pushed.targets?.live?.ok) {
			await log.error("push", "live website rejected tweets", pushed.targets?.live?.error || pushed.error || "unknown error");
			throw new Error(pushed.targets?.live?.error || pushed.error || "live tweet ingest failed");
		}
		if (!pushed.targets?.local?.ok) {
			await log.warn("push", "live website updated but local archive failed", pushed.targets?.local?.error);
		} else {
			await log.info("push", "live website and local archive updated", { count: tweets.length });
		}
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
  const deleteAlarm = await chrome.alarms.get(DELETE_RETRY_ALARM);
  if (!deleteAlarm) {
    chrome.alarms.create(DELETE_RETRY_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: DELETE_RETRY_MINUTES,
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
  if (alarm.name === DELETE_RETRY_ALARM) processDeleteQueue();
});

ensureAutoFetchAlarm();

async function pushTweetsToReceiver(tweets) {
  const status = { time: Date.now(), count: tweets?.length ?? 0 };
  try {
    if (!LOG_INGEST_TOKEN) throw new Error("no ingest token — add config.local.js");
    if (!tweets?.length) throw new Error("no tweets returned");

	const cached = await chrome.storage.local.get(CACHE_KEY);
	const cachedByUrl = new Map((cached[CACHE_KEY]?.tweets ?? []).map((tweet) => [tweet.url, tweet]));
	const ready = [];
	for (const tweet of tweets) {
		const prior = cachedByUrl.get(tweet.url);
		if (tweet.threadResolved && tweet.threadVersion === THREAD_RESOLVER_VERSION) {
			ready.push(tweet);
			continue;
		}
		if (prior?.threadResolved && prior.threadVersion === THREAD_RESOLVER_VERSION) {
			ready.push({
				...tweet,
				...prior,
				text: tweet.text,
				timestamp: tweet.timestamp,
				date: tweet.date,
				...(prior.isReply ? {} : { isReply: false, replyTo: null, replyToUrl: null, replyThread: null }),
			});
			continue;
		}

		let metadata = null;
		for (let attempt = 0; attempt < 4 && !metadata; attempt += 1) {
			try {
				metadata = await resolveThreadViaApi(tweet.url);
			} catch {
				// Public metadata can lag immediately after posting.
			}
			if (!metadata && attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
		}
		if (metadata?.threadResolved) ready.push({ ...tweet, ...metadata });
	}
	if (!ready.length) throw new Error("no thread-resolved tweets ready to publish");

	await chrome.storage.local.set({
		[CACHE_KEY]: {
			tweets: Array.from(new Map(
				[...(cached[CACHE_KEY]?.tweets ?? []), ...ready].map((tweet) => [tweet.url, tweet]),
			).values()).sort((a, b) => Date.parse(b.timestamp ?? 0) - Date.parse(a.timestamp ?? 0)).slice(0, 100),
			fetchedAt: Date.now(),
		},
	});

    const body = JSON.stringify({ tweets: ready });
    const push = (url) => fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${LOG_INGEST_TOKEN}`,
		},
		body,
	});
	const [local, live] = await serializeMutation(() => Promise.allSettled([
		push(TWEETS_INGEST_URL),
		push(LIVE_TWEETS_INGEST_URL),
	]));
	const targets = {};
	for (const [name, result] of [["local", local], ["live", live]]) {
		if (result.status === "rejected") {
			targets[name] = { ok: false, error: result.reason?.message ?? String(result.reason) };
		} else if (!result.value.ok) {
			targets[name] = { ok: false, error: `${result.value.status} ${await result.value.text()}` };
		} else {
			targets[name] = { ok: true, error: null };
		}
	}
	const failures = Object.entries(targets)
		.filter(([, target]) => !target.ok)
		.map(([name, target]) => `${name}: ${target.error}`);
	const pushStatus = {
		...status,
		count: ready.length,
		pending: tweets.length - ready.length,
		ok: failures.length === 0,
		error: failures.join(" · ") || null,
		targets,
	};
	await chrome.storage.local.set({ [PUSH_STATUS_KEY]: pushStatus });
	if (failures.length) await log.warn("push", "one or more tweet destinations failed", targets);
	return pushStatus;
  } catch (err) {
    await log.error("push", "push to receiver failed", err);
	const pushStatus = {
		...status,
		ok: false,
		error: err.message,
		targets: {
			local: { ok: false, error: err.message },
			live: { ok: false, error: err.message },
		},
	};
    await chrome.storage.local.set({ [PUSH_STATUS_KEY]: pushStatus });
    return pushStatus;
  }
}

function normalizeTweetUrl(value) {
	const input = String(value ?? "").trim();
	if (/^\d+$/.test(input)) return `https://x.com/merulox/status/${input}`;
	const match = input.match(/^https:\/\/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/);
	return match ? `https://x.com/${match[1]}/status/${match[2]}` : null;
}

async function removeTweetFromCache(key, url) {
	const stored = await chrome.storage.local.get(key);
	const value = stored[key];
	if (!Array.isArray(value?.tweets)) return;
	await chrome.storage.local.set({
		[key]: {
			...value,
			tweets: value.tweets.filter((tweet) => tweet.url !== url),
			updatedAt: Date.now(),
		},
	});
}

async function enqueueTombstone(value, source = "manual") {
	const url = normalizeTweetUrl(value);
	if (!url) throw new Error("enter an X tweet URL or status ID");
	const stored = await chrome.storage.local.get(DELETE_QUEUE_KEY);
	const queue = Array.isArray(stored[DELETE_QUEUE_KEY]) ? stored[DELETE_QUEUE_KEY] : [];
	const prior = queue.find((item) => item.url === url);
	const item = prior ?? {
		url,
		source,
		createdAt: Date.now(),
		attempts: 0,
		targets: { local: false, live: false },
	};
	await chrome.storage.local.set({
		[DELETE_QUEUE_KEY]: [item, ...queue.filter((entry) => entry.url !== url)],
	});
	return item;
}

async function runDeleteQueue() {
	const stored = await chrome.storage.local.get(DELETE_QUEUE_KEY);
	const queue = Array.isArray(stored[DELETE_QUEUE_KEY]) ? stored[DELETE_QUEUE_KEY] : [];
	const remaining = [];
	let latest = null;

	for (const item of queue) {
		const targets = { ...(item.targets ?? { local: false, live: false }) };
		const errors = [];
		for (const [name, endpoint] of [["local", TWEETS_INGEST_URL], ["live", LIVE_TWEETS_INGEST_URL]]) {
			if (targets[name]) continue;
			try {
				const response = await serializeMutation(() => fetch(endpoint, {
					method: "DELETE",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${LOG_INGEST_TOKEN}`,
					},
					body: JSON.stringify({ url: item.url, source: item.source }),
				}));
				if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
				targets[name] = true;
			} catch (error) {
				errors.push(`${name}: ${error?.message ?? error}`);
			}
		}

		await Promise.all([
			removeTweetFromCache(CACHE_KEY, item.url),
			removeTweetFromCache(OBSERVED_KEY, item.url),
		]);
		const complete = targets.local && targets.live;
		latest = {
			time: Date.now(),
			url: item.url,
			source: item.source,
			ok: complete,
			targets,
			error: errors.join(" · ") || null,
		};
		if (!complete) {
			remaining.push({
				...item,
				targets,
				attempts: (item.attempts ?? 0) + 1,
				lastAttemptAt: Date.now(),
				lastError: latest.error,
			});
		}
	}

	await chrome.storage.local.set({
		[DELETE_QUEUE_KEY]: remaining,
		...(latest ? { [DELETE_STATUS_KEY]: latest } : {}),
	});
	return latest ?? { ok: true, pending: 0 };
}

function processDeleteQueue() {
	if (!activeDeleteProcess) {
		activeDeleteProcess = runDeleteQueue().finally(() => {
			activeDeleteProcess = null;
		});
	}
	return activeDeleteProcess;
}

async function tombstoneTweet(value, source = "manual") {
	const status = { time: Date.now(), url: normalizeTweetUrl(value), source };
	try {
		if (!LOG_INGEST_TOKEN) throw new Error("no ingest token — add config.local.js");
		await enqueueTombstone(value, source);
		const result = await processDeleteQueue();
		if (result.ok) await log.info("delete", "tweet tombstoned", { url: status.url, source });
		else await log.warn("delete", "tweet tombstone partially failed", result);
		return result;
	} catch (err) {
		const result = { ...status, ok: false, error: err.message };
		await chrome.storage.local.set({ [DELETE_STATUS_KEY]: result });
		await log.error("delete", "tweet tombstone failed", result);
		return result;
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
  if (msg.action === "tombstoneTweet") {
    tombstoneTweet(msg.url ?? msg.statusId, msg.source).then(sendResponse);
    return true;
  }
  if (msg.action === "chatgptHistory") {
    pushChatgpt(msg).then(sendResponse);
    return true;
  }
});
