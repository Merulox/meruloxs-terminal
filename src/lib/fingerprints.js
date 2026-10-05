import { cleanPath, TRACKED_HOSTS } from "./visits.js";

const BOT_UA = /bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget|python|httpclient|okhttp|java\//i;
export const MAX_FINGERPRINT_BODY = 48_000;
const SESSION_ID = /^[a-zA-Z0-9_-]{16,80}$/;
const HASH = /^[a-f0-9]{64}$/;

// Returns { status } when the request must not be recorded, else { row }.
export function parseFingerprint(request, bodyText, now = Date.now()) {
	const url = new URL(request.url);
	if (!TRACKED_HOSTS.has(url.hostname)) return { status: 204, reason: "untracked host" };

	const origin = request.headers.get("Origin");
	if (origin) {
		let originHost = null;
		try {
			originHost = new URL(origin).hostname;
		} catch {}
		if (!TRACKED_HOSTS.has(originHost)) return { status: 403, reason: "foreign origin" };
	}
	if (BOT_UA.test(request.headers.get("User-Agent") ?? "")) return { status: 204, reason: "bot" };
	if (
		typeof bodyText !== "string" ||
		bodyText.length > MAX_FINGERPRINT_BODY ||
		new TextEncoder().encode(bodyText).byteLength > MAX_FINGERPRINT_BODY
	) {
		return { status: 413, reason: "payload too large" };
	}

	let body;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return { status: 400, reason: "invalid json" };
	}
	const path = cleanPath(body?.p);
	if (!path) return { status: 400, reason: "invalid path" };
	if (body?.v !== 1) return { status: 400, reason: "invalid version" };
	if (typeof body?.sid !== "string" || !SESSION_ID.test(body.sid)) {
		return { status: 400, reason: "invalid session" };
	}
	if (typeof body?.hash !== "string" || !HASH.test(body.hash)) {
		return { status: 400, reason: "invalid hash" };
	}
	if (!body?.attributes || typeof body.attributes !== "object" || Array.isArray(body.attributes)) {
		return { status: 400, reason: "invalid attributes" };
	}
	const attributes = JSON.stringify(body.attributes);

	const rawIp = request.headers.get("CF-Connecting-IP");
	const ip = typeof rawIp === "string" && rawIp.trim() ? rawIp.trim().slice(0, 45) : null;
	return {
		row: {
			ts: Math.floor(now / 1000),
			ip,
			path,
			sessionId: body.sid,
			hash: body.hash,
			attributes,
		},
	};
}

export async function recordFingerprint(db, row) {
	await db
		.prepare(
			`INSERT INTO fingerprints (ts, ip, path, session_id, fingerprint_hash, attributes)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(session_id, fingerprint_hash) DO UPDATE SET
			 ts = excluded.ts, ip = excluded.ip, path = excluded.path, attributes = excluded.attributes`,
		)
		.bind(row.ts, row.ip, row.path, row.sessionId, row.hash, row.attributes)
		.run();
}
