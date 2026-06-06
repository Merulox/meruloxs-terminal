// Cloudflare Pages Function — generates each summary once, then stores it in KV.

export async function onRequest(context) {
	if (context.request.method === "OPTIONS") {
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET",
			},
		});
	}

	const url = new URL(context.request.url);
	const postUrl = url.searchParams.get("url");

	const headers = {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Cache-Control": "public, max-age=86400",
	};

	if (!postUrl) {
		return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers });
	}

	let parsedPostUrl;
	try {
		parsedPostUrl = new URL(postUrl);
		if (parsedPostUrl.protocol !== "https:" || parsedPostUrl.hostname !== "merulox.substack.com") {
			throw new Error("unsupported host");
		}
	} catch {
		return new Response(JSON.stringify({ error: "valid merulox.substack.com URL required" }), {
			status: 400,
			headers,
		});
	}

	const key = `summary:${parsedPostUrl.pathname}`;
	const stored = await context.env.SUBSTACK_SUMMARIES?.get(key);
	if (stored) {
		return new Response(JSON.stringify({ summary: stored, source: "kv" }), { headers });
	}

	if (!context.env.AI || !context.env.SUBSTACK_SUMMARIES) {
		return new Response(JSON.stringify({ error: "AI or SUBSTACK_SUMMARIES binding not configured" }), {
			status: 500,
			headers,
		});
	}

	try {
		// Fetch post and strip HTML to plain text
		const postRes = await fetch(postUrl, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; summary-bot/1.0)" },
		});
		const html = await postRes.text();
		const text = html
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 5000);

		const result = await context.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content: "You write concise one-sentence descriptions for personal essays. Be specific to the actual content, not generic. Maximum 100 characters. No quotes.",
				},
				{
					role: "user",
					content: `What is this essay actually about? One sentence, max 100 chars:\n\n${text}`,
				},
			],
			max_tokens: 80,
		});

		const summary = (result.response ?? "").trim();
		if (!summary) throw new Error("empty summary");

		await context.env.SUBSTACK_SUMMARIES.put(key, summary);
		return new Response(JSON.stringify({ summary, source: "generated" }), { headers });
	} catch (err) {
		return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
	}
}
