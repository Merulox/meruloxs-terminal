// POST /api/outbound-click — public, non-blocking external-link event for merulox.com.
import { MAX_BODY, parseOutboundClick, recordOutboundClick } from "../../src/lib/visits.js";

const empty = (status) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }) {
	if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY) return empty(413);
	const parsed = parseOutboundClick(request, await request.text());
	if (!parsed.row) return empty(parsed.status);
	if (!env.VISITS_DB) return empty(503);
	await recordOutboundClick(env.VISITS_DB, parsed.row);
	return empty(204);
}

export function onRequestGet() {
	return empty(405);
}
