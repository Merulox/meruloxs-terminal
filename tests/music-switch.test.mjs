import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";
import { onRequestGet, onRequestPatch } from "../functions/api/music.js";
import { initMusicVisibility } from "../src/lib/music-visibility.mjs";
import { isMusicPath, publicMusicEnabled } from "../src/lib/music-switch.js";

function kv(values = {}, { fail = false } = {}) {
	const map = new Map(Object.entries(values));
	const calls = [];
	return {
		map, calls,
		async get(key) { calls.push(["get", key]); if (fail) throw new Error("kv down"); return map.get(key) ?? null; },
		async put(key, value) { calls.push(["put", key, value]); map.set(key, value); },
	};
}

const HTML = '<nav><a href="/projects">p</a><a href="/music">m</a><a href="/links">l</a></nav>';
function ctx(url, store, { html = true, init = {} } = {}) {
	return {
		data: {},
		env: { DEV_AUTH_USER: "m", DEV_AUTH_PASSWORD: "secret", LOG_KV_TOKEN: "ingest", SITE_CONTROL: store },
		request: new Request(url, init),
		next: async () => new Response(html ? HTML : "{}", { headers: { "Content-Type": html ? "text/html; charset=utf-8" : "application/json" } }),
	};
}

test("music off: public /music, /music/, /music.html and subpaths 404 without caching", async () => {
	for (const path of ["/music", "/music/", "/music.html", "/Music", "/music/x"]) {
		const res = await onRequest(ctx(`https://merulox.com${path}`, kv({ music_enabled: "0" })));
		assert.equal(res.status, 404, path);
		assert.equal(res.headers.get("Cache-Control"), "no-store");
	}
	assert.equal(isMusicPath("/musical"), false);
	assert.equal(isMusicPath("/api/music"), false);
});

test("music on, missing, or KV error keeps public /music reachable", async () => {
	for (const store of [kv({ music_enabled: "1" }), kv(), kv({}, { fail: true }), undefined]) {
		assert.equal((await onRequest(ctx("https://merulox.com/music", store))).status, 200);
	}
	assert.equal(await publicMusicEnabled({ SITE_CONTROL: kv({ music_enabled: "0" }, { fail: true }) }), true);
});

test("music off strips nav entries from public HTML only", { skip: typeof HTMLRewriter === "undefined" && "HTMLRewriter unavailable outside Workers" }, async () => {
	const res = await onRequest(ctx("https://merulox.com/", kv({ music_enabled: "0" })));
	const text = await res.text();
	assert.equal(text.includes('href="/music"'), false);
	assert.match(text, /\/projects/);
});

test("non-HTML public responses and the music-on case never read the music flag", async () => {
	const store = kv({ music_enabled: "0" });
	const res = await onRequest(ctx("https://merulox.com/api/tweets", store, { html: false }));
	assert.equal(res.status, 200);
	assert.deepEqual(store.calls, [["get", "site_enabled"]]);
});

test("site_enabled=0 still wins over the music flag", async () => {
	const res = await onRequest(ctx("https://merulox.com/music", kv({ site_enabled: "0", music_enabled: "1" })));
	assert.equal(res.status, 503);
});

test("dev host ignores the music switch", async () => {
	const res = await onRequest(ctx("https://dev.merulox.com/music", kv({ music_enabled: "0" }), { init: { headers: { Authorization: `Basic ${btoa("m:secret")}` } } }));
	assert.equal(res.status, 200);
});

for (const [value, enabled] of [[null, true], ["0", false], ["1", true]]) {
	test(`GET reads ${value} as enabled=${enabled}`, async () => {
		const store = kv(value === null ? {} : { music_enabled: value });
		const res = await onRequestGet({ env: { SITE_CONTROL: store } });
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { enabled });
		assert.deepEqual(store.calls, [["get", "music_enabled"]]);
	});
}

test("GET rejects unknown values and missing binding with 503", async () => {
	assert.equal((await onRequestGet({ env: { SITE_CONTROL: kv({ music_enabled: "yes" }) } })).status, 503);
	assert.equal((await onRequestGet({ env: {} })).status, 503);
});

function patch(store, { url = "https://dev.merulox.com/api/music", data = { devAuthenticated: true }, body = '{"enabled":false}', headers = { "Content-Type": "application/json" } } = {}) {
	return { request: new Request(url, { method: "PATCH", headers, body }), env: { SITE_CONTROL: store }, data };
}

test("PATCH persists both directions on dev only and touches only music_enabled", async () => {
	const store = kv({ site_enabled: "1", moodboard_enabled: "1" });
	for (const enabled of [false, true]) {
		const res = await onRequestPatch(patch(store, { body: JSON.stringify({ enabled }) }));
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { enabled });
		assert.equal(store.map.get("music_enabled"), enabled ? "1" : "0");
	}
	assert.equal(store.map.get("site_enabled"), "1");
	assert.equal(store.map.get("moodboard_enabled"), "1");
});

test("PATCH is forbidden off the dev host, unauthenticated, or cross-origin", async () => {
	for (const host of ["merulox.com", "www.merulox.com", "dev.merulox.com.evil.example"]) {
		const store = kv();
		assert.equal((await onRequestPatch(patch(store, { url: `https://${host}/api/music` }))).status, 403);
		assert.equal(store.calls.length, 0);
	}
	assert.equal((await onRequestPatch(patch(kv(), { data: {} }))).status, 403);
	assert.equal((await onRequestPatch(patch(kv(), { headers: { "Content-Type": "application/json", Origin: "https://evil.example" } }))).status, 403);
});

test("PATCH validates content type and body", async () => {
	assert.equal((await onRequestPatch(patch(kv(), { headers: { "Content-Type": "text/plain" } }))).status, 415);
	assert.equal((await onRequestPatch(patch(kv(), { body: "nope" }))).status, 400);
	assert.equal((await onRequestPatch(patch(kv(), { body: '{"enabled":"0"}' }))).status, 400);
});

class El extends EventTarget { hidden = false; disabled = false; textContent = ""; attrs = {}; setAttribute(k, v) { this.attrs[k] = v; } }
const tick = () => new Promise((r) => setImmediate(r));

test("UI: public never shows controls or fetches", async () => {
	let fetched = 0;
	const controls = new El(), button = new El(), status = new El(), abort = new AbortController();
	initMusicVisibility({ controls, button, status, isDev: false, signal: abort.signal, pollMs: 0, fetchImpl: async () => { fetched++; return { ok: true, json: async () => ({ enabled: true }) }; } });
	await tick();
	assert.equal(controls.hidden, true);
	assert.equal(fetched, 0);
	abort.abort();
});

test("UI: dev toggles both directions and reports failed writes", async () => {
	let value = true; const writes = [];
	const controls = new El(), button = new El(), status = new El(), abort = new AbortController();
	const ui = initMusicVisibility({ controls, button, status, isDev: true, signal: abort.signal, pollMs: 0, fetchImpl: async (_u, o) => {
		if (o.method === "PATCH") { value = JSON.parse(o.body).enabled; writes.push(value); }
		return { ok: true, json: async () => ({ enabled: value }) };
	} });
	await tick();
	assert.equal(controls.hidden, false);
	assert.equal(button.textContent, "Disable music on public site");
	await ui.toggle(); await ui.toggle();
	assert.deepEqual(writes, [false, true]);
	abort.abort();

	const a2 = new AbortController(), b2 = new El(), s2 = new El();
	const bad = initMusicVisibility({ controls: new El(), button: b2, status: s2, isDev: true, signal: a2.signal, pollMs: 0, fetchImpl: async (_u, o) => o?.method === "PATCH" ? { ok: false } : { ok: true, json: async () => ({ enabled: true }) } });
	await tick(); await bad.toggle();
	assert.match(s2.textContent, /Could not save/);
	assert.equal(b2.attrs["aria-pressed"], "true");
	a2.abort();
});
