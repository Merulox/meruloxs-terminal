const OBSERVED_KEY = "tweets_observed";
const SCREEN_NAME = "merulox";
const MAX_OBSERVED = 120;
const WRITE_DELAY_MS = 500;
const PUSH_DELAY_MS = 10_000;

const observed = new Map();
let writeTimer = null;
let pushTimer = null;
let collecting = false;
let pendingDeleteUrl = null;

const markerStyle = document.createElement("style");
markerStyle.textContent = `
	.merulox-delete-sync {
		margin-left: 8px;
		padding: 1px 5px;
		border: 1px solid rgb(29, 155, 240);
		border-radius: 999px;
		color: rgb(29, 155, 240);
		font: 600 10px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
		white-space: nowrap;
	}
`;
document.documentElement.appendChild(markerStyle);

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

function readArticle(article) {
	const timeEl = article.querySelector("time");
	const textEl = article.querySelector('[data-testid="tweetText"], div[lang], span[lang]');
	const linkEl = timeEl?.closest(`a[href*="/${SCREEN_NAME}/status/"]`)
		?? article.querySelector(`a[href*="/${SCREEN_NAME}/status/"]`);
	if (!timeEl || !textEl || !linkEl) return null;

	const href = linkEl.getAttribute("href")?.split("?")[0];
	const text = textEl.textContent?.trim();
	if (!href || !text) return null;

	const timestamp = timeEl.getAttribute("datetime");
	const author = href.match(/^\/([^/]+)\/status\//)?.[1];
	// Capture attached images while excluding avatars and profile photos.
	const mediaImgs = Array.from(article.querySelectorAll('img[src*="pbs.twimg.com/media"]'));
	const media = mediaImgs
		.map((img) => {
			const src = img.getAttribute("src") || "";
			const url = new URL(src);
			url.searchParams.set("format", "jpg");
			url.searchParams.set("name", "medium");
			return url.toString();
		})
		.filter((url, index, urls) => urls.indexOf(url) === index);
	const replyContext = article.innerText
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.startsWith("Replying to"));

	return {
		text,
		date: easternDate(timestamp),
		timestamp,
		url: `https://x.com${href}`,
		author: author ? `@${author}` : `@${SCREEN_NAME}`,
		observedAt: Date.now(),
		...(media.length > 0 ? { media } : {}),
		...(replyContext ? {
			isReply: true,
			replyTo: replyContext.replace(/^Replying to\s*/i, "").trim(),
		} : {}),
	};
}

function scheduleWrite() {
	clearTimeout(writeTimer);
	writeTimer = setTimeout(writeObserved, WRITE_DELAY_MS);
}

async function writeObserved() {
	const current = await chrome.storage.local.get(OBSERVED_KEY);
	const prior = current[OBSERVED_KEY]?.tweets ?? [];
	const merged = new Map(prior.map((tweet) => [tweet.url, tweet]));
	for (const tweet of observed.values()) merged.set(tweet.url, tweet);

	const tweets = Array.from(merged.values())
		.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
		.slice(0, MAX_OBSERVED);

	await chrome.storage.local.set({
		[OBSERVED_KEY]: {
			tweets,
			updatedAt: Date.now(),
			page: location.href,
		},
	});
	clearTimeout(pushTimer);
	pushTimer = setTimeout(() => {
		chrome.runtime.sendMessage({ action: "pushTweets", tweets });
	}, PUSH_DELAY_MS);
}

function collectRenderedTweets() {
	if (collecting || !location.pathname.startsWith(`/${SCREEN_NAME}`)) return;
	collecting = true;
	let changed = false;

	try {
		for (const article of document.querySelectorAll("article")) {
			const tweet = readArticle(article);
			if (!tweet) continue;
			const prior = observed.get(tweet.url);
			if (!prior
				|| prior.text !== tweet.text
				|| prior.replyTo !== tweet.replyTo
				|| JSON.stringify(prior.media ?? []) !== JSON.stringify(tweet.media ?? [])) {
				observed.set(tweet.url, tweet);
				changed = true;
			}
		}
	} finally {
		collecting = false;
	}

	if (changed) scheduleWrite();
}

function ownTweetUrl(article) {
	const timeHref = article?.querySelector("time")?.closest('a[href*="/status/"]')?.getAttribute("href")?.split("?")[0];
	if (timeHref?.match(/^\/merulox\/status\/\d+$/i)) return `https://x.com${timeHref}`;
	const links = Array.from(article?.querySelectorAll('a[href*="/status/"]') ?? []);
	const href = links
		.map((link) => link.getAttribute("href")?.split("?")[0])
		.find((value) => value?.match(/^\/merulox\/status\/\d+$/i));
	return href ? `https://x.com${href}` : null;
}

function addSyncMarker(control) {
	if (!control || control.querySelector(".merulox-delete-sync")) return;
	const marker = document.createElement("span");
	marker.className = "merulox-delete-sync";
	marker.textContent = "site sync";
	control.appendChild(marker);
}

function augmentDeleteControls() {
	if (!pendingDeleteUrl) return;
	for (const item of document.querySelectorAll('[role="menuitem"]')) {
		if (item.textContent?.trim().startsWith("Delete")) addSyncMarker(item);
	}
	for (const button of document.querySelectorAll('[data-testid="confirmationSheetConfirm"]')) {
		if (!button.textContent?.trim().startsWith("Delete")) continue;
		addSyncMarker(button);
	}
}

document.addEventListener("click", (event) => {
	const caret = event.target.closest?.('[data-testid="caret"]');
	if (caret) {
		pendingDeleteUrl = ownTweetUrl(caret.closest("article"));
		queueMicrotask(augmentDeleteControls);
	}
	const confirm = event.target.closest?.('[data-testid="confirmationSheetConfirm"]');
	if (confirm?.textContent?.trim().startsWith("Delete") && pendingDeleteUrl) {
		const url = pendingDeleteUrl;
		pendingDeleteUrl = null;
		chrome.runtime.sendMessage({ action: "tombstoneTweet", url, source: "x-delete-confirm" });
	}
}, { capture: true });

const observer = new MutationObserver(() => {
	collectRenderedTweets();
	augmentDeleteControls();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("scroll", collectRenderedTweets, { passive: true });
window.addEventListener("pagehide", writeObserved);
collectRenderedTweets();
