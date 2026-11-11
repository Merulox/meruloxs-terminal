import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";
import { onRequestGet, onRequestPatch } from "../functions/api/music.js";
import { initMusicSettings } from "../src/lib/music-settings.mjs";
import {
	applyMusicPatch, applyPublicMusic, defaultMusicConfig, isMusicPath, normalizeMusicConfig,
	parseMusicPatch, publicMusicAction, readMusicConfig,
} from "../src/lib/music-switch.js";

function kv(values = {}, { fail = false } = {}) {
	const map = new Map(Object.entries(values));
	const calls = [];
	return {
		map, calls,
		async get(key) { calls.push(["get", key]); if (fail) throw new Error("kv down"); return map.get(key) ?? null; },
		async put(key, value) { calls.push(["put", key, value]); map.set(key, value); },
	};
}
const cfg = (config) => JSON.stringify(config);
const config = (page = {}, sections = {}) => ({ ...defaultMusicConfig(), page: { ...defaultMusicConfig().page, ...page }, sections: { ...defaultMusicConfig().sections, ...sections } });

const HTML = '<nav><a href="/projects">p</a><a href="/music">m</a></nav>';
function ctx(url, store, { html = true, headers = {}, onNext } = {}) {
	return {
		data: {},
		env: { DEV_AUTH_USER: "m", DEV_AUTH_PASSWORD: "secret", LOG_KV_TOKEN: "ingest", SITE_CONTROL: store },
		request: new Request(url, { headers: { Accept: html ? "text/html" : "application/json", ...headers } }),
		next: async (req) => {
			onNext?.(req);
			return new Response(html ? HTML : "{}", { headers: { "Content-Type": html ? "text/html; charset=utf-8" : "application/json", ETag: '"abc"', "Last-Modified": "x" } });
		},
	};
}

test("normalize fails open on junk and keeps valid fields", () => {
	assert.deepEqual(normalizeMusicConfig(null), defaultMusicConfig());
	assert.deepEqual(normalizeMusicConfig({ page: { enabled: "no", whenDisabled: "bogus" }, sections: { recent: 0 } }), defaultMusicConfig());
	const out = normalizeMusicConfig({ page: { enabled: false, whenDisabled: "notice" }, sections: { albums: false, nope: false } });
	assert.deepEqual(out.page, { enabled: false, whenDisabled: "notice" });
	assert.equal(out.sections.albums, false);
	assert.equal("nope" in out.sections, false);
});

test("readMusicConfig fails open on missing binding, bad JSON, and KV errors", async () => {
	assert.deepEqual(await readMusicConfig({}), defaultMusicConfig());
	assert.deepEqual(await readMusicConfig({ SITE_CONTROL: kv({ music_config: "{not json" }) }), defaultMusicConfig());
	assert.deepEqual(await readMusicConfig({ SITE_CONTROL: kv({ music_config: cfg(config({ enabled: false })) }, { fail: true }) }), defaultMusicConfig());
});

test("publicMusicAction covers every page/section combination", () => {
	assert.equal(publicMusicAction(config(), "/music/"), "pass");
	assert.equal(publicMusicAction(config(), "/"), "pass");
	assert.equal(publicMusicAction(config({}, { artists: false }), "/music/"), "sections");
	assert.equal(publicMusicAction(config({}, { artists: false }), "/links/"), "pass");
	assert.equal(publicMusicAction(config({ enabled: false }), "/music/"), "not-found");
	assert.equal(publicMusicAction(config({ enabled: false }), "/music"), "not-found");
	assert.equal(publicMusicAction(config({ enabled: false }), "/links/"), "strip-nav");
	assert.equal(publicMusicAction(config({ enabled: false, whenDisabled: "notice" }), "/music/"), "notice");
	assert.equal(publicMusicAction(config({ enabled: false, whenDisabled: "notice" }), "/links/"), "pass");
	assert.equal(isMusicPath("/musical"), false);
	assert.equal(isMusicPath("/api/music"), false);
});

test("page disabled + hide-tab: every music path 404s without caching", async () => {
	for (const path of ["/music", "/music/", "/music.html", "/Music", "/music/x"]) {
		const res = await onRequest(ctx(`https://merulox.com${path}`, kv({ music_config: cfg(config({ enabled: false })) })));
		assert.equal(res.status, 404, path);
		assert.equal(res.headers.get("Cache-Control"), "no-store");
	}
});

test("fully enabled, missing, corrupt, or erroring config serves the music page untouched", async () => {
	for (const store of [kv({ music_config: cfg(config()) }), kv(), kv({ music_config: "garbage" }), kv({}, { fail: true }), undefined]) {
		const res = await onRequest(ctx("https://merulox.com/music/", store));
		assert.equal(res.status, 200);
		assert.equal(res.headers.get("ETag"), '"abc"');
	}
});

const rewriterTest = { skip: typeof HTMLRewriter === "undefined" && "HTMLRewriter unavailable outside Workers" };

test("hide-tab strips nav from public HTML and the variant is uncacheable", rewriterTest, async () => {
	const res = await onRequest(ctx("https://merulox.com/", kv({ music_config: cfg(config({ enabled: false })) })));
	const text = await res.text();
	assert.equal(text.includes('href="/music"'), false);
	assert.match(text, /\/projects/);
	assert.equal(res.headers.get("ETag"), null);
	assert.equal(res.headers.get("Last-Modified"), null);
	assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("rewritten variants forward requests without conditional headers", rewriterTest, async () => {
	let seen;
	const store = kv({ music_config: cfg(config({ enabled: false })) });
	await onRequest(ctx("https://merulox.com/", store, { headers: { "If-None-Match": '"abc"', "If-Modified-Since": "x" }, onNext: (req) => { seen = req; } }));
	assert.equal(seen.headers.get("If-None-Match"), null);
	assert.equal(seen.headers.get("If-Modified-Since"), null);
});

test("unmodified pass-through keeps conditional headers and validators", async () => {
	let seen;
	const res = await onRequest(ctx("https://merulox.com/", kv({ music_config: cfg(config()) }), { headers: { "If-None-Match": '"abc"' }, onNext: (req) => { seen = req; } }));
	assert.equal(seen.headers.get("If-None-Match"), '"abc"');
	assert.equal(res.headers.get("ETag"), '"abc"');
});

test("notice mode keeps the tab and replaces page content", rewriterTest, async () => {
	const store = kv({ music_config: cfg(config({ enabled: false, whenDisabled: "notice" })) });
	const page = ctx("https://merulox.com/music/", store);
	page.next = async () => new Response('<main><div data-music-root><h1>Music</h1><section data-music-section="recent">secret</section></div></main>', { headers: { "Content-Type": "text/html" } });
	const text = await (await onRequest(page)).text();
	assert.match(text, /currently disabled/);
	assert.equal(text.includes("secret"), false);
	const home = await (await onRequest(ctx("https://merulox.com/", store))).text();
	assert.equal(home.includes('href="/music"'), true);
});

test("section toggles remove only the disabled sections", rewriterTest, async () => {
	const store = kv({ music_config: cfg(config({}, { albums: false, recent: false })) });
	const page = ctx("https://merulox.com/music/", store);
	page.next = async () => new Response('<div data-music-root><section data-music-section="recent">R</section><section data-music-section="artists">A</section><div data-music-section="albums">B</div><section data-music-section="tracks">T</section></div>', { headers: { "Content-Type": "text/html" } });
	const text = await (await onRequest(page)).text();
	assert.equal(/>R</.test(text), false);
	assert.equal(/>B</.test(text), false);
	assert.match(text, />A</);
	assert.match(text, />T</);
});

test("non-HTML public requests never read the music config", async () => {
	const store = kv({ music_config: cfg(config({ enabled: false })) });
	const res = await onRequest(ctx("https://merulox.com/api/tweets", store, { html: false }));
	assert.equal(res.status, 200);
	assert.deepEqual(store.calls, [["get", "site_enabled"]]);
});

test("site_enabled=0 still wins over the music config", async () => {
	const res = await onRequest(ctx("https://merulox.com/music/", kv({ site_enabled: "0", music_config: cfg(config()) })));
	assert.equal(res.status, 503);
});

test("dev host ignores the music config", async () => {
	const c = ctx("https://dev.merulox.com/music/", kv({ music_config: cfg(config({ enabled: false })) }), { headers: { Authorization: `Basic ${btoa("m:secret")}` } });
	assert.equal((await onRequest(c)).status, 200);
});

test("parseMusicPatch accepts only known, correctly typed fields", () => {
	assert.deepEqual(parseMusicPatch({ page: { enabled: false } }), { ok: true, patch: { page: { enabled: false } } });
	assert.deepEqual(parseMusicPatch({ page: { whenDisabled: "notice" }, sections: { recent: false } }).ok, true);
	for (const bad of [null, [], {}, { page: {} }, { page: { enabled: "1" } }, { page: { whenDisabled: "x" } }, { page: { extra: 1 } }, { sections: { nope: true } }, { sections: { recent: "no" } }, { sections: {} }, { other: 1 }]) {
		assert.equal(parseMusicPatch(bad).ok, false, JSON.stringify(bad));
	}
	const merged = applyMusicPatch(defaultMusicConfig(), { sections: { tracks: false } });
	assert.equal(merged.sections.tracks, false);
	assert.equal(merged.sections.recent, true);
});

test("GET returns defaults, stored config, and 503 on failure", async () => {
	assert.deepEqual(await (await onRequestGet({ env: { SITE_CONTROL: kv() } })).json(), defaultMusicConfig());
	const stored = config({ enabled: false, whenDisabled: "notice" }, { albums: false });
	assert.deepEqual(await (await onRequestGet({ env: { SITE_CONTROL: kv({ music_config: cfg(stored) }) } })).json(), stored);
	assert.equal((await onRequestGet({ env: {} })).status, 503);
	assert.equal((await onRequestGet({ env: { SITE_CONTROL: kv({}, { fail: true }) } })).status, 503);
});

function patch(store, { url = "https://dev.merulox.com/api/music", data = { devAuthenticated: true }, body = '{"page":{"enabled":false}}', headers = { "Content-Type": "application/json" } } = {}) {
	return { request: new Request(url, { method: "PATCH", headers, body }), env: { SITE_CONTROL: store }, data };
}

test("PATCH merges into stored config and leaves unrelated keys alone", async () => {
	const store = kv({ site_enabled: "1", moodboard_enabled: "1" });
	let res = await onRequestPatch(patch(store, { body: '{"page":{"enabled":false,"whenDisabled":"notice"}}' }));
	assert.equal(res.status, 200);
	res = await onRequestPatch(patch(store, { body: '{"sections":{"albums":false}}' }));
	const out = await res.json();
	assert.deepEqual(out.page, { enabled: false, whenDisabled: "notice" });
	assert.equal(out.sections.albums, false);
	assert.equal(out.sections.recent, true);
	assert.deepEqual(JSON.parse(store.map.get("music_config")), out);
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
	assert.equal((await onRequestPatch(patch(kv(), { body: '{"page":{"enabled":"0"}}' }))).status, 400);
	assert.equal((await onRequestPatch(patch(kv(), { body: '{"sections":{"bogus":true}}' }))).status, 400);
});

class El extends EventTarget { hidden = false; disabled = false; textContent = ""; value = ""; attrs = {}; setAttribute(k, v) { this.attrs[k] = v; } }
const tick = () => new Promise((r) => setImmediate(r));

function ui(isDev, fetchImpl) {
	const els = { controls: new El(), pageButton: new El(), modeSelect: new El(), status: new El(), sectionButtons: { recent: new El(), artists: new El(), albums: new El(), tracks: new El() } };
	const abort = new AbortController();
	const api = initMusicSettings({ ...els, isDev, signal: abort.signal, pollMs: 0, fetchImpl });
	return { ...els, abort, api };
}
const ok = (body) => ({ ok: true, json: async () => body });

test("UI: public hides controls and never fetches", async () => {
	let fetched = 0;
	const u = ui(false, async () => { fetched++; return ok(defaultMusicConfig()); });
	await tick();
	assert.equal(u.controls.hidden, true);
	assert.equal(u.sectionButtons.recent.hidden, true);
	assert.equal(fetched, 0);
	u.abort.abort();
});

test("UI: dev page, mode and per-section buttons send the matching PATCH", async () => {
	let state = defaultMusicConfig(); const bodies = [];
	const u = ui(true, async (_url, o) => {
		if (o.method === "PATCH") { const b = JSON.parse(o.body); bodies.push(b); state = applyMusicPatch(state, b); }
		return ok(state);
	});
	await tick();
	assert.equal(u.controls.hidden, false);
	assert.equal(u.pageButton.textContent, "Disable whole page on public site");
	u.pageButton.dispatchEvent(new Event("click")); await tick();
	u.modeSelect.value = "notice"; u.modeSelect.dispatchEvent(new Event("change")); await tick();
	u.sectionButtons.albums.dispatchEvent(new Event("click")); await tick();
	u.sectionButtons.albums.dispatchEvent(new Event("click")); await tick();
	assert.deepEqual(bodies, [{ page: { enabled: false } }, { page: { whenDisabled: "notice" } }, { sections: { albums: false } }, { sections: { albums: true } }]);
	assert.equal(u.pageButton.textContent, "Enable whole page on public site");
	assert.match(u.status.textContent, /currently disabled/);
	u.abort.abort();
});

test("UI: failed write reports the error and keeps the last known state", async () => {
	const u = ui(true, async (_url, o) => o?.method === "PATCH" ? { ok: false } : ok(defaultMusicConfig()));
	await tick();
	u.sectionButtons.recent.dispatchEvent(new Event("click")); await tick();
	assert.match(u.status.textContent, /Could not save/);
	assert.equal(u.sectionButtons.recent.attrs["aria-pressed"], "true");
	u.abort.abort();
});

test("applyPublicMusic skips the KV read for non-navigation, non-music requests", async () => {
	const store = kv({ music_config: cfg(config({ enabled: false })) });
	const res = await applyPublicMusic(new Request("https://merulox.com/style.css", { headers: { Accept: "text/css" } }), { SITE_CONTROL: store }, async () => new Response("css"));
	assert.equal(res.status, 200);
	assert.equal(store.calls.length, 0);
});
