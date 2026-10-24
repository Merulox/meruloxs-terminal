// GET /api/visit-count — public, aggregate-only visit count for the status bar.
// Returns ONLY a total number. No IPs, geo, paths, or referrers — that
// granular data stays behind the auth-gated dev dashboard
// (functions/api/visits.js, dev.merulox.com only). This is intentionally a
// separate, narrower query rather than reusing summarize() from
// src/lib/visits.js, so nothing sensitive is ever computed for a public route.
export async function onRequestGet({ env }) {
	const headers = {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Cache-Control": "public, max-age=300",
	};
	if (!env.VISITS_DB) {
		return new Response(JSON.stringify({ views: null }), { headers });
	}
	try {
		const row = await env.VISITS_DB.prepare(
			"SELECT COUNT(*) AS views FROM visits",
		).first();
		return new Response(JSON.stringify({ views: row?.views ?? 0 }), { headers });
	} catch {
		return new Response(JSON.stringify({ views: null }), { headers });
	}
}

export function onRequestPost() {
	return new Response(null, { status: 405 });
}
