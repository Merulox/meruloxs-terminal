// Cloudflare Pages Function — uses Cloudflare Workers AI (free tier)
// Requires: add AI binding named "AI" in Cloudflare Pages → Settings → Functions → AI bindings

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
		"Cache-Control": "public, max-age=2592000",
	};

	if (!postUrl) {
		return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers });
	}

	if (!context.env.AI) {
		return new Response(JSON.stringify({ error: "AI binding not configured — add it in Cloudflare Pages → Settings → Functions → AI bindings" }), {
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
		return new Response(JSON.stringify({ summary }), { headers });
	} catch (err) {
		return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
	}
}
