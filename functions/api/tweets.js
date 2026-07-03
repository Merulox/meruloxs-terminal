const STORE_KEY = "tweets";
const MAX_TWEETS = 1000;
const MAX_TOMBSTONES = 2000;
const MAX_BODY = 1_000_000;
const SCHEMA_VERSION = 6;

const headers = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
	"Cache-Control": "no-store",
};

function response(payload, status = 200) {
	return new Response(JSON.stringify(payload), { status, headers });
}

async function mutateStore(context, transform, attempts = 4) {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const current = await context.env.LIVE_TWEETS.get(STORE_KEY, "json") ?? {};
		const mutationId = crypto.randomUUID();
		const payload = { ...transform(current), mutationId };
		await context.env.LIVE_TWEETS.put(STORE_KEY, JSON.stringify(payload));
		const confirmed = await context.env.LIVE_TWEETS.get(STORE_KEY, "json");
		if (confirmed?.mutationId === mutationId) return payload;
	}
	throw new Error("live tweet store changed concurrently; retry the request");
}

function cleanString(value, maxLength) {
	return typeof value === "string" && value.trim()
		? value.trim().slice(0, maxLength)
		: undefined;
}

function normalizeTweetUrl(value) {
	const input = cleanString(value, 500);
	if (!input) return null;
	if (/^\d+$/.test(input)) return `https://x.com/merulox/status/${input}`;
	const match = input.match(/^https:\/\/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/);
	return match ? `https://x.com/${match[1]}/status/${match[2]}` : null;
}

function tombstoneUrls(stored) {
	return new Set((stored?.tombstones ?? []).map((item) => item?.url).filter(Boolean));
}

function normalizePost(post) {
	if (!post || typeof post !== "object") return null;
	const text = cleanString(post.text, 10_000);
	const url = normalizeTweetUrl(post.url);
	if (!text || !url) return null;

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

	if (Array.isArray(post.media)) {
		const media = post.media
			.slice(0, 4)
			.map((url) => cleanString(url, 1000))
			.filter((url) => /^https:\/\/pbs\.twimg\.com\/media\//.test(url));
		if (media.length) normalized.media = [...new Set(media)];
	}
	if (Array.isArray(post.replyThread)) {
		const replyThread = post.replyThread.slice(0, 5).map(normalizePost).filter(Boolean);
		if (replyThread.length) normalized.replyThread = replyThread;
	}
	return normalized;
}

function standalonePost(post) {
	const { isReply, replyTo, replyToUrl, replyThread, ...standalone } = post;
	return { ...standalone, threadResolved: true, threadVersion: 6 };
}

function isPublishable(post) {
	return post.threadResolved === true && (!post.isReply || Boolean(post.replyToUrl));
}

async function resolveThread(post) {
	if (post.threadResolved === true && (!post.isReply || post.replyToUrl)) return post;
	const statusId = post.url.match(/\/status\/(\d+)/)?.[1];
	if (!statusId) return post;

	try {
		const apiResponse = await fetch(`https://api.fxtwitter.com/status/${statusId}`);
		if (!apiResponse.ok) return post;
		const current = (await apiResponse.json()).tweet;
		if (!current) return post;
		if (!current.replying_to_status) {
			return standalonePost(post);
		}

		const replyTo = cleanString(current.replying_to, 100);
		const replyToUrl = replyTo
			? `https://x.com/${replyTo.replace(/^@/, "")}/status/${current.replying_to_status}`
			: undefined;
		if (!replyToUrl) return post;
		return {
			...post,
			threadResolved: true,
			threadVersion: 6,
			isReply: true,
			...(replyTo ? { replyTo: `@${replyTo.replace(/^@/, "")}` } : {}),
			replyToUrl,
		};
	} catch {
		return post;
	}
}

function mergeTweets(existing, incoming) {
	const byUrl = new Map(existing.map((tweet) => [tweet.url, tweet]));
	for (const tweet of incoming) {
		const prior = byUrl.get(tweet.url) ?? {};
		const base = tweet.threadResolved === true && tweet.isReply !== true
			? standalonePost(prior)
			: prior;
		byUrl.set(tweet.url, {
			...base,
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
	return response({
		tweets: stored?.tweets ?? [],
		updatedAt: stored?.updatedAt ?? 0,
		visible: stored?.visible !== false,
		tombstoneCount: stored?.tombstones?.length ?? 0,
		schemaVersion: SCHEMA_VERSION,
		postLimit: MAX_TWEETS,
	});
}

export async function onRequestPost(context) {
	if (!context.env.LIVE_TWEETS || !context.env.LOG_KV_TOKEN) {
		return response({ error: "live tweet store is not configured" }, 503);
	}
	const token = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
	const bearerAuthorized = Boolean(token && token === context.env.LOG_KV_TOKEN);
	if (!bearerAuthorized && context.data?.devAuthenticated !== true) {
		return response({ error: "unauthorized" }, 401);
	}

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

	const resolvedIncoming = await Promise.all(incoming.map(resolveThread));
	let publishableCount = 0;
	const payload = await mutateStore(context, (stored) => {
		const existing = Array.isArray(stored?.tweets) ? stored.tweets : [];
		const tombstones = Array.isArray(stored?.tombstones) ? stored.tombstones : [];
		const deletedUrls = tombstoneUrls(stored);
		const existingByUrl = new Map(existing.map((tweet) => [tweet.url, tweet]));
		const authoritativeIncoming = resolvedIncoming.map((tweet) => {
			const prior = existingByUrl.get(tweet.url);
			return prior?.threadResolved === true && tweet.threadResolved !== true ? prior : tweet;
		});
		const publishable = authoritativeIncoming.filter((tweet) => isPublishable(tweet) && !deletedUrls.has(tweet.url));
		publishableCount = publishable.length;
		return {
			tweets: mergeTweets(existing.filter((tweet) => isPublishable(tweet) && !deletedUrls.has(tweet.url)), publishable),
			tombstones,
			visible: stored?.visible !== false,
			updatedAt: Date.now(),
		};
	});
	return response({
		status: "ok",
		stored: payload.tweets.length,
		pending: resolvedIncoming.length - publishableCount,
		updatedAt: payload.updatedAt,
		schemaVersion: SCHEMA_VERSION,
	});
}

export async function onRequestPatch(context) {
	if (!context.env.LIVE_TWEETS || context.data?.devAuthenticated !== true) {
		return response({ error: "unauthorized" }, 401);
	}

	let body;
	try {
		body = await context.request.json();
	} catch {
		return response({ error: "invalid JSON" }, 400);
	}
	if (typeof body?.visible !== "boolean") {
		return response({ error: "visible must be a boolean" }, 400);
	}

	const payload = await mutateStore(context, (stored) => ({
		...stored,
		visible: body.visible,
		updatedAt: Date.now(),
	}));
	return response({ status: "ok", visible: payload.visible, updatedAt: payload.updatedAt });
}

export async function onRequestDelete(context) {
	if (!context.env.LIVE_TWEETS || !context.env.LOG_KV_TOKEN) {
		return response({ error: "live tweet store is not configured" }, 503);
	}
	const token = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
	const bearerAuthorized = Boolean(token && token === context.env.LOG_KV_TOKEN);
	if (!bearerAuthorized && context.data?.devAuthenticated !== true) {
		return response({ error: "unauthorized" }, 401);
	}

	let body;
	try {
		body = await context.request.json();
	} catch {
		return response({ error: "invalid JSON" }, 400);
	}
	const url = normalizeTweetUrl(body?.url ?? body?.statusId);
	if (!url) return response({ error: "url or statusId must identify an X post" }, 400);

	let removed = 0;
	const payload = await mutateStore(context, (stored) => {
		const existing = Array.isArray(stored?.tweets) ? stored.tweets : [];
		const tombstones = Array.isArray(stored?.tombstones) ? stored.tombstones : [];
		const tweets = existing.filter((tweet) => tweet.url !== url);
		removed = existing.length - tweets.length;
		return {
			tweets,
			visible: stored?.visible !== false,
			tombstones: [
				{ url, deletedAt: new Date().toISOString(), source: cleanString(body?.source, 100) ?? "manual" },
				...tombstones.filter((item) => item?.url !== url),
			].slice(0, MAX_TOMBSTONES),
			updatedAt: Date.now(),
		};
	});
	return response({
		status: "ok",
		url,
		removed,
		tombstoneCount: payload.tombstones.length,
		updatedAt: payload.updatedAt,
	});
}
