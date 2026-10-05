import { parseFingerprint, recordFingerprint } from "../../src/lib/fingerprints.js";

const empty = (status) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }) {
	if (!env.VISITS_DB) return empty(503);
	const parsed = parseFingerprint(request, await request.text());
	if (!parsed.row) return empty(parsed.status);
	await recordFingerprint(env.VISITS_DB, parsed.row);
	return empty(204);
}

export function onRequest() {
	return empty(405);
}
