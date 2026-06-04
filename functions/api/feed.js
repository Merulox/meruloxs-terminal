// Cloudflare Pages Function — fetches Substack RSS directly, no caching middleman

const FEED_URL = "https://merulox.substack.com/feed";

function extractCdata(tag, xml) {
	const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i");
	const m = xml.match(re);
	return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function parseItems(xml) {
	const items = [];
	const itemRe = /<item>([\s\S]*?)<\/item>/g;
	let m;
	while ((m = itemRe.exec(xml)) !== null) {
		const item = m[1];
		items.push({
			title: extractCdata("title", item),
			link: extractCdata("link", item) || item.match(/<link\s*\/?>(.*?)<\/link>/i)?.[1]?.trim() || "",
			pubDate: extractCdata("pubDate", item),
			description: extractCdata("description", item),
		});
	}
	return items;
}

export async function onRequest(context) {
	const headers = {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Cache-Control": "no-store",
	};

	try {
		const res = await fetch(FEED_URL, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; feed-fetcher/1.0)" },
		});
		if (!res.ok) throw new Error(`Substack returned ${res.status}`);

		const xml = await res.text();
		const items = parseItems(xml);

		return new Response(JSON.stringify({ status: "ok", items }), { headers });
	} catch (err) {
		return new Response(JSON.stringify({ status: "error", message: err.message }), {
			status: 502,
			headers,
		});
	}
}
