// POST /api/visit — public page-view beacon for merulox.com.
// Stores path, entry flag, referrer host, and Cloudflare edge geolocation.
import { MAX_BODY, parseVisit, recordVisit } from "../../src/lib/visits.js";

const empty = (status) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }) {
	if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY) return empty(413);
	const parsed = parseVisit(request, await request.text());
	if (!parsed.row) return empty(parsed.status);
	if (!env.VISITS_DB) return empty(503);
	await recordVisit(env.VISITS_DB, parsed.row);
	return empty(204);
}

export function onRequestGet() {
	return empty(405);
}
