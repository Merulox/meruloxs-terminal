const KEY = "moodboard_enabled";

function json(body, status = 200) {
	return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function onRequestGet({ env }) {
	try {
		if (!env?.SITE_CONTROL) return json({ error: "Moodboard state unavailable" }, 503);
		const value = await env.SITE_CONTROL.get(KEY);
		if (value !== null && value !== "0" && value !== "1") {
			return json({ error: "Moodboard state unavailable" }, 503);
		}
		return json({ enabled: value !== "0" });
	} catch {
		return json({ error: "Moodboard state unavailable" }, 503);
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
	if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.enabled !== "boolean") {
		return json({ error: "Expected an enabled boolean" }, 400);
	}

	try {
		if (!env?.SITE_CONTROL) return json({ error: "Moodboard state unavailable" }, 503);
		await env.SITE_CONTROL.put(KEY, body.enabled ? "1" : "0");
		return json({ enabled: body.enabled });
	} catch {
		return json({ error: "Moodboard state unavailable" }, 503);
	}
}
