const STORE_KEY = "tweets";
const MAX_TWEETS = 1000;
const MAX_BODY = 1_000_000;

const headers = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Cache-Control": "no-store",
};

function response(payload, status = 200) {
	return new Response(JSON.stringify(payload), { status, headers });
}

function cleanString(value, maxLength) {
	return typeof value === "string" && value.trim()
		? value.trim().slice(0, maxLength)
		: undefined;
}

function normalizePost(post) {
	if (!post || typeof post !== "object") return null;
	const text = cleanString(post.text, 10_000);
	const url = cleanString(post.url, 500);
	if (!text || !url || !/^https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/.test(url)) return null;

	const timestamp = cleanString(post.timestamp, 40);
	const normalized = {
		text,
		url,
		date: cleanString(post.date, 10),
		...(timestamp && !Number.isNaN(Date.parse(timestamp)) ? { timestamp: new Date(timestamp).toISOString() } : {}),
		...(cleanString(post.author, 100) ? { author: cleanString(post.author, 100) } : {}),
		...(post.threadResolved === true ? { threadResolved: true } : {}),
		...(Number.isInteger(post.threadVersion) ? { threadVersion: post.threadVersion } : {}),
		...(post.isReply === true ? { isReply: true } : {}),
		...(cleanString(post.replyTo, 200) ? { replyTo: cleanString(post.replyTo, 200) } : {}),
		...(cleanString(post.replyToUrl, 500) ? { replyToUrl: cleanString(post.replyToUrl, 500) } : {}),
	};

	if (Array.isArray(post.replyThread)) {
		const replyThread = post.replyThread.slice(0, 5).map(normalizePost).filter(Boolean);
		if (replyThread.length) normalized.replyThread = replyThread;
	}
	return normalized;
}

function mergeTweets(existing, incoming) {
	const byUrl = new Map(existing.map((tweet) => [tweet.url, tweet]));
	for (const tweet of incoming) {
		const prior = byUrl.get(tweet.url) ?? {};
		byUrl.set(tweet.url, {
			...prior,
			...tweet,
			...(prior.threadResolved === true && tweet.threadResolved !== true ? prior : {}),
		});
	}
	return Array.from(byUrl.values())
		.sort((a, b) => Date.parse(b.timestamp ?? b.date ?? 0) - Date.parse(a.timestamp ?? a.date ?? 0))
		.slice(0, MAX_TWEETS);
}

export async function onRequestOptions() {
	return new Response(null, { status: 204, headers });
}

export async function onRequestGet(context) {
	const stored = await context.env.LIVE_TWEETS?.get(STORE_KEY, "json");
	return response(stored ?? { tweets: [], updatedAt: 0 });
}

export async function onRequestPost(context) {
	if (!context.env.LIVE_TWEETS || !context.env.LOG_KV_TOKEN) {
		return response({ error: "live tweet store is not configured" }, 503);
	}
	const token = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
	if (!token || token !== context.env.LOG_KV_TOKEN) return response({ error: "unauthorized" }, 401);

	const length = Number(context.request.headers.get("Content-Length") ?? 0);
	if (length > MAX_BODY) return response({ error: "payload too large" }, 413);

	let body;
	try {
		body = await context.request.json();
	} catch {
		return response({ error: "invalid JSON" }, 400);
	}
	const incoming = Array.isArray(body?.tweets) ? body.tweets.map(normalizePost).filter(Boolean) : [];
	if (!incoming.length) return response({ error: "tweets must contain valid posts" }, 400);

	const stored = await context.env.LIVE_TWEETS.get(STORE_KEY, "json");
	const tweets = mergeTweets(Array.isArray(stored?.tweets) ? stored.tweets : [], incoming);
	const payload = { tweets, updatedAt: Date.now() };
	await context.env.LIVE_TWEETS.put(STORE_KEY, JSON.stringify(payload));
	return response({ status: "ok", stored: tweets.length, updatedAt: payload.updatedAt });
}
