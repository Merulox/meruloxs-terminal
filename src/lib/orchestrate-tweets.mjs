// Groups replies under their parent post (explicit replyToUrl only) and orders the feed.
// Ordering is strictly by each conversation root's own timestamp, newest first, so a fresh
// reply never drags an old post to the top. Inside a conversation, posts run oldest -> newest.

const toTime = (tweet) => Date.parse(tweet.timestamp ?? "") || 0;

export function orchestrateTweets(input, { limit = Infinity } = {}) {
	const replies = new Map();
	const roots = [];
	const urls = new Set(input.map((tweet) => tweet.url));
	const inputOrder = new Map(input.map((tweet, index) => [tweet.url, index]));

	for (const tweet of input) {
		if (tweet.isReply && tweet.replyToUrl && urls.has(tweet.replyToUrl) && tweet.replyToUrl !== tweet.url) {
			replies.set(tweet.replyToUrl, [...(replies.get(tweet.replyToUrl) ?? []), tweet]);
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
	const isRoot = (tweet) => !(tweet.isReply && tweet.replyToUrl && shown.has(tweet.replyToUrl) && tweet.replyToUrl !== tweet.url);
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
		const isRoot = !(tweet.isReply && tweet.replyToUrl && urls.has(tweet.replyToUrl) && tweet.replyToUrl !== tweet.url);
		if (isRoot && count >= size) {
			page += 1;
			count = 0;
		}
		pages.push(page);
		count += 1;
	}
	return pages;
}
