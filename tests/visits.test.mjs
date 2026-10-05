import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { onRequestPost } from "../functions/api/visit.js";
import { onRequestGet } from "../functions/api/visits.js";
import { onRequest as visitsGate } from "../functions/visits/_middleware.js";
import { cleanPath, parseVisit, referrerHost } from "../src/lib/visits.js";

const SCHEMA = ["0001_visits.sql", "0002_visits_ip.sql", "0003_visits_source.sql"]
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
	assert.deepEqual(body.referrers, [{ referrer: "news.ycombinator.com", views: 1, visits: 1 }]);
	assert.equal(body.daily.length, 1);
	assert.equal(body.daily[0].views, 4);
	assert.equal(body.totals.ips, 1);
	assert.equal(body.recent.length, 4);
	assert.equal(body.recent[0].ip, "203.0.113.7");
	assert.equal(body.recent[0].source, "beacon");

	// Imported Cloudflare rows count by weight, never as visits.
	env.VISITS_DB.raw.exec("INSERT INTO visits (ts, path, entry, country, ip, source, weight, import_key) VALUES (strftime('%s','now') - 60, '/music', 0, 'DE', '198.51.100.9', 'cloudflare', 10, 'k1')");
	const mixed = await (await get("https://dev.merulox.com/api/visits?range=7d", { devAuthenticated: true })).json();
	assert.equal(mixed.totals.views, 14);
	assert.equal(mixed.totals.visits, 3);
	assert.equal(mixed.totals.imported, 10);
	assert.equal(mixed.totals.ips, 2);
});

test("/visits page is hidden outside dev.merulox.com", async () => {
	const ctx = (url) => ({ request: new Request(url), next: async () => new Response("page") });
	assert.equal((await visitsGate(ctx("https://merulox.com/visits"))).status, 404);
	assert.equal((await visitsGate(ctx("https://abc.merulox.pages.dev/visits/"))).status, 404);
	assert.equal(await (await visitsGate(ctx("https://dev.merulox.com/visits"))).text(), "page");
});
