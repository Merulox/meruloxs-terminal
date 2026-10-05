import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { onRequestPost } from "../functions/api/visit.js";
import { onRequestPost as onFingerprintPost } from "../functions/api/fingerprint.js";
import { enrichIp, onRequestGet } from "../functions/api/visits.js";
import { onRequest as visitsGate } from "../functions/visits/_middleware.js";
import { cleanPath, normalizeIp, parseVisit, referrerHost, reverseName } from "../src/lib/visits.js";

const SCHEMA = ["0001_visits.sql", "0002_visits_ip.sql", "0003_visits_source.sql", "0004_visits_ip_index.sql", "0005_fingerprints.sql"]
	.map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"))
	.join("\n");

// Minimal D1 facade over node:sqlite (prepare → bind → run/all).
function d1() {
	const db = new DatabaseSync(":memory:");
	db.exec(SCHEMA);
	return {
		raw: db,
		prepare(sql) {
			let params = [];
			const api = {
				bind: (...values) => ((params = values), api),
				run: async () => db.prepare(sql).run(...params),
				all: async () => ({ results: db.prepare(sql).all(...params).map((row) => ({ ...row })) }),
			};
			return api;
		},
	};
}

const CF = { country: "CA", region: "Quebec", city: "Montreal", latitude: "45.50884", longitude: "-73.58781", colo: "YUL" };

function beacon(url, body, headers = {}, cf = CF) {
	const request = new Request(url, {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: { Origin: "https://merulox.com", "User-Agent": "Mozilla/5.0 Firefox/131.0", "CF-Connecting-IP": "203.0.113.7", ...headers },
	});
	Object.defineProperty(request, "cf", { value: cf });
	return request;
}

test("path and referrer normalisation", () => {
	assert.equal(cleanPath("/thinking/?x=1#top"), "/thinking");
	assert.equal(cleanPath("/"), "/");
	assert.equal(cleanPath("/api/visit"), null);
	assert.equal(cleanPath("/visits"), null);
	assert.equal(cleanPath("https://evil.example/"), null);
	assert.equal(referrerHost("https://www.google.com/search?q=merulox"), "google.com");
	assert.equal(referrerHost("https://merulox.com/projects"), null);
	assert.equal(referrerHost("https://dev.merulox.com/"), null);
	assert.equal(referrerHost("javascript:alert(1)"), null);
});

test("beacon stores visitor IP and geo", async () => {
	const env = { VISITS_DB: d1() };
	const response = await onRequestPost({
		request: beacon("https://merulox.com/api/visit", { p: "/links/", r: "https://x.com/merulox", e: 1 }),
		env,
	});
	assert.equal(response.status, 204);
	const rows = env.VISITS_DB.raw.prepare("SELECT * FROM visits").all();
	assert.equal(rows.length, 1);
	assert.deepEqual(
		{ ...rows[0], id: undefined, ts: undefined },
		{ id: undefined, ts: undefined, path: "/links", entry: 1, referrer: "x.com", country: "CA", region: "Quebec", city: "Montreal", lat: 45.51, lon: -73.59, colo: "YUL", ip: "203.0.113.7", source: "beacon", weight: 1, import_key: null },
	);
});

test("fingerprint endpoint stores bounded attributes and updates one tab snapshot", async () => {
	const env = { VISITS_DB: d1() };
	const hash = "a".repeat(64);
	const payload = {
		v: 1,
		p: "/",
		sid: "session_1234567890",
		hash,
		attributes: {
			browser: { platform: "Linux x86_64", languages: ["en-CA", "en"] },
			screen: { screen: { width: 2560, height: 1440 } },
			canvas: { hash: "canvas-example" },
		},
	};
	const request = (body = payload, headers = {}) =>
		new Request("https://merulox.com/api/fingerprint", {
			method: "POST",
			body: JSON.stringify(body),
			headers: {
				Origin: "https://merulox.com",
				"User-Agent": "Mozilla/5.0 Firefox/131.0",
				"CF-Connecting-IP": "203.0.113.7",
				...headers,
			},
		});

	assert.equal((await onFingerprintPost({ request: request(), env })).status, 204);
	let rows = env.VISITS_DB.raw.prepare("SELECT * FROM fingerprints").all();
	assert.equal(rows.length, 1);
	assert.deepEqual(
		{ ip: rows[0].ip, path: rows[0].path, session: rows[0].session_id, hash: rows[0].fingerprint_hash, attributes: JSON.parse(rows[0].attributes) },
		{ ip: "203.0.113.7", path: "/", session: payload.sid, hash, attributes: payload.attributes },
	);

	assert.equal((await onFingerprintPost({ request: request({ ...payload, p: "/links" }), env })).status, 204);
	rows = env.VISITS_DB.raw.prepare("SELECT * FROM fingerprints").all();
	assert.equal(rows.length, 1, "same tab session and fingerprint updates instead of duplicating");
	assert.equal(rows[0].path, "/links");

	assert.equal((await onFingerprintPost({ request: request({ ...payload, hash: "bad" }), env })).status, 400);
	assert.equal((await onFingerprintPost({ request: request(payload, { Origin: "https://evil.example" }), env })).status, 403);
	assert.equal((await onFingerprintPost({ request: request(payload, { "User-Agent": "Googlebot" }), env })).status, 204);
	assert.equal((await onFingerprintPost({ request: request({ ...payload, attributes: { blob: "x".repeat(48_000) } }), env })).status, 413);
	assert.equal(env.VISITS_DB.raw.prepare("SELECT COUNT(*) AS count FROM fingerprints").get().count, 1);
});

test("beacon ignores dev/preview hosts, bots, and rejects foreign origins and junk", async () => {
	const env = { VISITS_DB: d1() };
	const post = (request) => onRequestPost({ request, env }).then((r) => r.status);
	assert.equal(await post(beacon("https://dev.merulox.com/api/visit", { p: "/" }, { Origin: "https://dev.merulox.com" })), 204);
	assert.equal(await post(beacon("https://abc.merulox.pages.dev/api/visit", { p: "/" })), 204);
	assert.equal(await post(beacon("https://merulox.com/api/visit", { p: "/" }, { "User-Agent": "Googlebot/2.1" })), 204);
	assert.equal(await post(beacon("https://merulox.com/api/visit", { p: "/" }, { Origin: "https://evil.example" })), 403);
	assert.equal(await post(beacon("https://merulox.com/api/visit", "not json")), 400);
	assert.equal(await post(beacon("https://merulox.com/api/visit", { p: "nope" })), 400);
	assert.equal(await post(beacon("https://merulox.com/api/visit", { p: `/${"a".repeat(2000)}` })), 413);
	assert.equal(env.VISITS_DB.raw.prepare("SELECT COUNT(*) AS n FROM visits").get().n, 0);
});

test("missing D1 binding fails visibly instead of pretending to record", async () => {
	const response = await onRequestPost({ request: beacon("https://merulox.com/api/visit", { p: "/" }), env: {} });
	assert.equal(response.status, 503);
	assert.equal(parseVisit(beacon("https://www.merulox.com/api/visit", { p: "/" }), JSON.stringify({ p: "/" })).row.path, "/");
});

test("aggregate API is dev-host only, authenticated, and groups by location", async () => {
	const env = { VISITS_DB: d1(), LOG_KV_TOKEN: "ingest" };
	const record = (body, cf) => onRequestPost({ request: beacon("https://merulox.com/api/visit", body, {}, cf), env });
	await record({ p: "/", e: 1 }, CF);
	await record({ p: "/links", e: 0 }, CF);
	await record({ p: "/", e: 1, r: "https://news.ycombinator.com/" }, { country: "JP", city: "Tokyo", region: "Tokyo", latitude: "35.69", longitude: "139.69" });
	await record({ p: "/music", e: 1 }, { country: "XX" });

	const get = (url, data = {}, headers = {}) =>
		onRequestGet({ request: new Request(url, { headers }), env, data });

	assert.equal((await get("https://merulox.com/api/visits")).status, 404);
	assert.equal((await get("https://dev.merulox.com/api/visits")).status, 401);
	assert.equal((await get("https://dev.merulox.com/api/visits?range=1y", { devAuthenticated: true })).status, 400);
	assert.equal((await get("https://dev.merulox.com/api/visits", {}, { Authorization: "Bearer ingest" })).status, 401);

	const response = await get("https://dev.merulox.com/api/visits?range=7d", { devAuthenticated: true });
	assert.equal(response.status, 200);
	const body = await response.json();
	assert.deepEqual(body.totals.views, 4);
	assert.deepEqual(body.totals.visits, 3);
	assert.deepEqual(body.totals.countries, 3);
	assert.deepEqual(
		body.points.map((p) => [p.city, p.views, p.visits]),
		[["Montreal", 2, 1], ["Tokyo", 1, 1]],
	);
	assert.deepEqual(body.countries[0], { country: "CA", views: 2, visits: 1 });
	assert.deepEqual(body.ips, [{ ip: "203.0.113.7", views: 4, visits: 3 }]);
	assert.deepEqual(body.referrers, [{ referrer: "news.ycombinator.com", views: 1, visits: 1 }]);
	assert.equal(body.daily.length, 1);
	assert.equal(body.daily[0].views, 4);
	assert.equal(body.totals.ips, 1);
	const recent = await (await get("https://dev.merulox.com/api/visits?view=history&range=7d", { devAuthenticated: true })).json();
	assert.equal(recent.rows.length, 4);
	assert.equal(recent.rows[0].ip, "203.0.113.7");
	assert.equal(recent.rows[0].source, "beacon");

	// Imported Cloudflare rows count by weight, never as visits.
	env.VISITS_DB.raw.exec("INSERT INTO visits (ts, path, entry, country, ip, source, weight, import_key) VALUES (strftime('%s','now') - 60, '/music', 0, 'DE', '198.51.100.9', 'cloudflare', 10, 'k1')");
	const mixed = await (await get("https://dev.merulox.com/api/visits?range=7d", { devAuthenticated: true })).json();
	assert.equal(mixed.totals.views, 14);
	assert.equal(mixed.totals.visits, 3);
	assert.equal(mixed.totals.imported, 10);
	assert.equal(mixed.totals.ips, 2);
	assert.deepEqual(mixed.ips, [
		{ ip: "198.51.100.9", views: 10, visits: 0 },
		{ ip: "203.0.113.7", views: 4, visits: 3 },
	]);
	const mixedRows = await (await get("https://dev.merulox.com/api/visits?view=history&range=7d", { devAuthenticated: true })).json();
	assert.equal(mixedRows.rows.find((r) => r.source === "cloudflare").weight, 10);

	// Re-importing the same import_key is ignored (import uses INSERT OR IGNORE).
	env.VISITS_DB.raw.exec("INSERT OR IGNORE INTO visits (ts, path, entry, country, ip, source, weight, import_key) VALUES (strftime('%s','now') - 60, '/music', 0, 'DE', '198.51.100.9', 'cloudflare', 10, 'k1')");
	const again = await (await get("https://dev.merulox.com/api/visits?range=7d", { devAuthenticated: true })).json();
	assert.equal(again.totals.views, 14);
});

test("summary lists expose up to 50 entries by default", async () => {
	const env = { VISITS_DB: d1() };
	const insert = env.VISITS_DB.raw.prepare(
		"INSERT INTO visits (ts, path, entry, referrer, country, region, city, ip, source, weight) VALUES (strftime('%s','now'), ?, 0, ?, ?, 'Region', ?, ?, 'beacon', ?)",
	);
	for (let i = 1; i <= 55; i += 1) {
		const suffix = String(i).padStart(2, "0");
		insert.run(`/page-${suffix}`, `ref-${suffix}.example`, `C${suffix}`, `City ${suffix}`, `10.0.0.${i}`, 100 - i);
	}
	const response = await onRequestGet({
		request: new Request("https://dev.merulox.com/api/visits?range=all"),
		env,
		data: { devAuthenticated: true },
	});
	assert.equal(response.status, 200);
	const body = await response.json();
	for (const key of ["countries", "cities", "ips", "paths", "referrers"]) {
		assert.equal(body[key].length, 50, key);
		assert.equal(body[key][0].views, 99, `${key} first`);
		assert.equal(body[key].at(-1).views, 50, `${key} last`);
	}
});

test("/visits page is hidden outside dev.merulox.com", async () => {
	const ctx = (url) => ({ request: new Request(url), next: async () => new Response("page") });
	assert.equal((await visitsGate(ctx("https://merulox.com/visits"))).status, 404);
	assert.equal((await visitsGate(ctx("https://abc.merulox.pages.dev/visits/"))).status, 404);
	assert.equal(await (await visitsGate(ctx("https://dev.merulox.com/visits"))).text(), "page");
});

test("IP validation and reverse DNS names", () => {
	assert.equal(normalizeIp(" 203.0.113.7 "), "203.0.113.7");
	assert.equal(normalizeIp("2001:DB8::1"), "2001:db8::1");
	for (const bad of ["256.1.1.1", "1.2.3", "2001:db8::1::2", "example.com", "1.2.3.4/../x", ""]) {
		assert.equal(normalizeIp(bad), null, bad);
	}
	assert.equal(reverseName("203.0.113.7"), "7.113.0.203.in-addr.arpa");
	assert.equal(reverseName("2001:db8::1"), `1.${"0.".repeat(23)}8.b.d.0.1.0.0.2.ip6.arpa`);
});

test("IP detail API returns one IP's weighted history; ipinfo only on request", async () => {
	const env = { VISITS_DB: d1() };
	const record = (body, ip) =>
		onRequestPost({ request: beacon("https://merulox.com/api/visit", body, { "CF-Connecting-IP": ip }), env });
	await record({ p: "/", e: 1 }, "203.0.113.7");
	await record({ p: "/links", e: 0 }, "203.0.113.7");
	await record({ p: "/", e: 1 }, "198.51.100.1");
	env.VISITS_DB.raw.exec("INSERT INTO visits (ts, path, entry, country, ip, source, weight, import_key) VALUES (strftime('%s','now') - 86400 * 3, '/music', 0, 'CA', '203.0.113.7', 'cloudflare', 4, 'k2')");
	env.VISITS_DB.raw
		.prepare("INSERT INTO fingerprints (ts, ip, path, session_id, fingerprint_hash, attributes) VALUES (strftime('%s','now'), ?, '/', ?, ?, ?)")
		.run("203.0.113.7", "session_abcdefghijkl", "b".repeat(64), JSON.stringify({ browser: { platform: "Linux x86_64" } }));

	const calls = [];
	const original = globalThis.fetch;
	globalThis.fetch = async (url) => {
		calls.push(String(url));
		const body = String(url).includes("ipinfo.io")
			? { org: "AS64500 Example Net", city: "Montreal", country: "CA", timezone: "America/Toronto" }
			: { Answer: [{ type: 12, data: "host.example.net." }] };
		return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
	};
	try {
		const get = (query, data = { devAuthenticated: true }) =>
			onRequestGet({ request: new Request(`https://dev.merulox.com/api/visits?${query}`), env, data });

		assert.equal((await get("ip=203.0.113.7", {})).status, 401);
		assert.equal((await get("ip=not-an-ip")).status, 400);

		const detail = await (await get("ip=203.0.113.7")).json();
		assert.equal(detail.ip, "203.0.113.7");
		assert.deepEqual(
			{ views: detail.totals.views, visits: detail.totals.visits, rows: detail.totals.rows, days: detail.totals.days, imported: detail.totals.imported },
			{ views: 6, visits: 1, rows: 3, days: 2, imported: 4 },
		);
		assert.deepEqual(detail.paths.map((p) => [p.path, p.views]), [["/music", 4], ["/", 1], ["/links", 1]]);
		assert.equal(detail.fingerprints.length, 1);
		assert.equal(detail.fingerprints[0].hash, "b".repeat(64));
		assert.equal(detail.fingerprints[0].attributes.browser.platform, "Linux x86_64");
		assert.equal(calls.length, 0, "detail must not wait on any network lookup");

		const history = await (await get("view=history&ip=203.0.113.7")).json();
		assert.deepEqual([history.total, history.page, history.pages, history.rows.length], [3, 1, 1, 3]);
		assert.ok(history.rows.every((r) => r.ip === "203.0.113.7"), "history is isolated to the IP");
		assert.equal(history.rows.at(-1).weight, 4);

		const network = (await (await get("view=network&ip=203.0.113.7")).json()).network;
		assert.deepEqual(network.reverseDns, ["host.example.net"]);
		assert.equal(network.ipinfo, "not queried");
		assert.ok(calls.every((u) => !u.includes("ipinfo.io")), "ipinfo must not be called by default");
		assert.ok(calls[0].includes("7.113.0.203.in-addr.arpa"));
		assert.equal((await get("view=network")).status, 400);

		const enriched = await (await get("view=network&ip=203.0.113.7&ipinfo=1")).json();
		assert.equal(enriched.network.ipinfo, "ok");
		assert.equal(enriched.network.asn, "AS64500");
		assert.equal(enriched.network.org, "Example Net");
		assert.ok(calls.some((u) => u === "https://ipinfo.io/203.0.113.7/json"));
	} finally {
		globalThis.fetch = original;
	}

	const failed = await enrichIp("203.0.113.7", { ipinfo: true, fetcher: async () => null });
	assert.deepEqual([failed.reverseDns, failed.asn, failed.ipinfo], [[], null, "unavailable"]);
});

test("history paging: pages, sizes, clamping, range and IP filters", async () => {
	const env = { VISITS_DB: d1() };
	const now = Math.floor(Date.now() / 1000);
	const insert = env.VISITS_DB.raw.prepare("INSERT INTO visits (ts, path, entry, ip, source, weight) VALUES (?, ?, 0, ?, 'beacon', 1)");
	// 130 rows for one IP over the last ~2 days, 7 rows for another, 5 rows older than 30 days.
	for (let i = 0; i < 130; i += 1) insert.run(now - i * 60, `/p${i}`, "203.0.113.7");
	for (let i = 0; i < 7; i += 1) insert.run(now - i * 90 - 30, "/other", "198.51.100.1");
	for (let i = 0; i < 5; i += 1) insert.run(now - 86400 * 40 - i, "/old", "203.0.113.7");

	const get = (query) =>
		onRequestGet({ request: new Request(`https://dev.merulox.com/api/visits?view=history&${query}`), env, data: { devAuthenticated: true } });
	const page = async (query) => (await get(query)).json();

	const first = await page("range=30d&size=50");
	assert.deepEqual([first.total, first.pages, first.page, first.size, first.rows.length], [137, 3, 1, 50, 50]);
	assert.equal(first.rows[0].path, "/p0", "newest first");

	const last = await page("range=30d&size=50&page=3");
	assert.deepEqual([last.page, last.rows.length], [3, 37]);
	const seen = new Set([...first.rows, ...(await page("range=30d&size=50&page=2")).rows, ...last.rows].map((r) => `${r.ts}${r.path}${r.ip}`));
	assert.equal(seen.size, 137, "pages do not overlap or skip rows");

	assert.equal((await page("range=30d&size=50&page=99")).page, 3, "page beyond the end clamps to the last page");
	assert.equal((await page("range=all&size=200")).total, 142);

	const ip = await page("ip=203.0.113.7&size=100&page=2");
	assert.deepEqual([ip.total, ip.pages, ip.page, ip.rows.length], [135, 2, 2, 35], "IP history spans all time");
	assert.ok(ip.rows.every((r) => r.ip === "203.0.113.7"));
	assert.equal(ip.rows.at(-1).path, "/old");

	const empty = await page("ip=192.0.2.1");
	assert.deepEqual([empty.total, empty.pages, empty.page, empty.rows.length], [0, 1, 1, 0]);

	for (const bad of ["size=7", "size=50&page=0", "size=50&page=1.5", "page=abc", "range=1y", "ip=nope"]) {
		assert.equal((await get(bad)).status, 400, bad);
	}
	const invalidView = await onRequestGet({ request: new Request("https://dev.merulox.com/api/visits?view=dump"), env, data: { devAuthenticated: true } });
	assert.equal(invalidView.status, 400);
});
