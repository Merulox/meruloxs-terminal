// Groups replies using explicit parent links and their saved ancestor chains.
// Ordering is strictly by each conversation root's own timestamp, newest first, so a fresh
// reply never drags an old post to the top. Inside a conversation, posts run oldest -> newest.

const toTime = (tweet) => Date.parse(tweet.timestamp ?? "") || 0;

function conversationParentUrl(tweet, urls) {
	if (!tweet.isReply || !tweet.replyToUrl || tweet.replyToUrl === tweet.url) return null;
	if (urls.has(tweet.replyToUrl)) return tweet.replyToUrl;
	// An outside-account reply may exist only in saved context, not as a feed
	// item. Attach to the nearest present ancestor without changing the real
	// direct reply target. Ignore context from a different/stale parent.
	const chain = tweet.replyThread;
	if (!Array.isArray(chain) || chain.at(-1)?.url !== tweet.replyToUrl) return null;
	for (let i = chain.length - 1; i >= 0; i -= 1) {
		const url = chain[i]?.url;
		if (url !== tweet.url && urls.has(url)) return url;
	}
	return null;
}

export function orchestrateTweets(input, { limit = Infinity } = {}) {
	const replies = new Map();
	const roots = [];
	const urls = new Set(input.map((tweet) => tweet.url));
	const inputOrder = new Map(input.map((tweet, index) => [tweet.url, index]));

	for (const tweet of input) {
		const parent = conversationParentUrl(tweet, urls);
		if (parent) {
			replies.set(parent, [...(replies.get(parent) ?? []), tweet]);
		} else {
			roots.push(tweet);
		}
	}

	const order = (a, b) => toTime(a) - toTime(b) || (inputOrder.get(a.url) ?? 0) - (inputOrder.get(b.url) ?? 0);
	for (const children of replies.values()) children.sort(order);

	const seen = new Set();
	const collect = (tweet) => {
		if (seen.has(tweet.url)) return [];
		seen.add(tweet.url);
		return [tweet, ...(replies.get(tweet.url) ?? []).flatMap(collect)];
	};

	// Depth-first keeps each reply directly beneath its parent, with siblings by time.
	const newestFirst = (a, b) => toTime(b) - toTime(a) || (inputOrder.get(a.url) ?? 0) - (inputOrder.get(b.url) ?? 0);
	const ordered = roots.slice().sort(newestFirst).flatMap(collect);
	// Anything unreachable from a root (a reply cycle) is still shown rather than dropped.
	const orphans = input.filter((tweet) => !seen.has(tweet.url)).sort(newestFirst).flatMap(collect);
	const all = [...ordered, ...orphans];
	if (all.length <= limit) return all;
	// Cap by whole conversations: never cut between a parent and its replies.
	const shown = new Set(all.map((tweet) => tweet.url));
	const isRoot = (tweet) => !conversationParentUrl(tweet, shown);
	let end = limit;
	while (end < all.length && !isRoot(all[end])) end += 1;
	return all.slice(0, end);
}

// Full-size variant of an X media URL for the lightbox.
export function fullSizeMediaUrl(url) {
	try {
		const parsed = new URL(url);
		parsed.searchParams.set("format", "jpg");
		parsed.searchParams.set("name", "large");
		return parsed.toString();
	} catch {
		return url;
	}
}

// Page number for each tweet (in display order). A page only breaks before a conversation root,
// so a conversation is never split across pages (pages may run slightly over `size`).
export function assignPages(tweets, size) {
	const urls = new Set(tweets.map((tweet) => tweet.url));
	const pages = [];
	let page = 0;
	let count = 0;
	for (const tweet of tweets) {
		const isRoot = !conversationParentUrl(tweet, urls);
		if (isRoot && count >= size) {
			page += 1;
			count = 0;
		}
		pages.push(page);
		count += 1;
	}
	return pages;
}
