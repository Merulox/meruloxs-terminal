import { MUSIC_CONFIG_KEY, applyMusicPatch, normalizeMusicConfig, parseMusicPatch } from "../../src/lib/music-switch.js";

function json(body, status = 200) {
	return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const UNAVAILABLE = "Music state unavailable";

async function loadConfig(env) {
	const raw = await env.SITE_CONTROL.get(MUSIC_CONFIG_KEY);
	if (raw === null) return normalizeMusicConfig(null);
	return normalizeMusicConfig(JSON.parse(raw));
}

export async function onRequestGet({ env }) {
	try {
		if (!env?.SITE_CONTROL) return json({ error: UNAVAILABLE }, 503);
		return json(await loadConfig(env));
	} catch {
		return json({ error: UNAVAILABLE }, 503);
	}
}

export async function onRequestPatch({ request, env, data }) {
	const url = new URL(request.url);
	if (url.hostname !== "dev.merulox.com" || data?.devAuthenticated !== true) {
		return json({ error: "Forbidden" }, 403);
	}
	const origin = request.headers.get("Origin");
	if (origin !== null && origin !== url.origin) return json({ error: "Forbidden" }, 403);
	const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
	if (contentType !== "application/json") return json({ error: "Expected application/json" }, 415);

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON body" }, 400);
	}
	const parsed = parseMusicPatch(body);
	if (!parsed.ok) return json({ error: "Expected page and/or sections with valid values" }, 400);

	try {
		if (!env?.SITE_CONTROL) return json({ error: UNAVAILABLE }, 503);
		const next = applyMusicPatch(await loadConfig(env), parsed.patch);
		await env.SITE_CONTROL.put(MUSIC_CONFIG_KEY, JSON.stringify(next));
		return json(next);
	} catch {
		return json({ error: UNAVAILABLE }, 503);
	}
}
