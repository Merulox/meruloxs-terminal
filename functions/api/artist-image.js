export async function onRequest(context) {
	const url = new URL(context.request.url);
	const name = url.searchParams.get("q") || "";

	const headers = {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Cache-Control": "public, max-age=86400",
	};

	if (!name) return new Response(JSON.stringify({ image: "" }), { headers });

	try {
		const res = await fetch(
			`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`,
		);
		const data = await res.json();
		const pic =
			data.data?.[0]?.picture_xl || data.data?.[0]?.picture_big || "";
		const image = pic.includes("images/artist//") ? "" : pic;
		return new Response(JSON.stringify({ image }), { headers });
	} catch {
		return new Response(JSON.stringify({ image: "" }), { headers });
	}
}
