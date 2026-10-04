// GET /api/visits?range=30d — aggregated visit data for the dev.merulox.com
// visits tab. Only served on the dev host, after the root middleware's auth.
import { DEV_HOST, rangeStart, summarize } from "../../src/lib/visits.js";

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
	});

export async function onRequestGet(context) {
	const { request, env, data } = context;
	const url = new URL(request.url);
	if (url.hostname !== DEV_HOST) return json({ error: "not found" }, 404);

	const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
	const bearerAuthorized = Boolean(token && env.LOG_KV_TOKEN && token === env.LOG_KV_TOKEN);
	if (!bearerAuthorized && data?.devAuthenticated !== true) return json({ error: "unauthorized" }, 401);

	const range = url.searchParams.get("range") ?? "30d";
	const since = rangeStart(range);
	if (since === null) return json({ error: "invalid range" }, 400);
	if (!env.VISITS_DB) return json({ error: "VISITS_DB binding missing" }, 503);

	return json({ range, since, generatedAt: Math.floor(Date.now() / 1000), ...(await summarize(env.VISITS_DB, since)) });
}
