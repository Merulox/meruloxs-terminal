import assert from "node:assert/strict";
import test from "node:test";
import { onRequest, publicSiteEnabled } from "../functions/_middleware.js";

function kv(value, { fail = false } = {}) {
	return { get: async () => { if (fail) throw new Error("kv down"); return value; } };
}

function context(url, env = {}, init = {}) {
	return {
		data: {},
		env: { DEV_AUTH_USER: "m", DEV_AUTH_PASSWORD: "secret", LOG_KV_TOKEN: "ingest", ...env },
		request: new Request(url, init),
		next: async () => new Response("ok"),
	};
}

test("switch off serves a non-cacheable 503 on public hosts", async () => {
	for (const url of ["https://merulox.com/", "https://www.merulox.com/thinking", "https://merulox.pages.dev/api/tweets"]) {
		const res = await onRequest(context(url, { SITE_CONTROL: kv("0") }));
		assert.equal(res.status, 503, url);
		assert.equal(res.headers.get("Cache-Control"), "no-store");
		assert.match(await res.text(), /offline/);
	}
	const head = await onRequest(context("https://merulox.com/", { SITE_CONTROL: kv("0") }, { method: "HEAD" }));
	assert.equal(head.status, 503);
	assert.equal(await head.text(), "");
});

test("switch on, missing key, missing binding, or KV error keeps the site public", async () => {
	assert.equal((await onRequest(context("https://merulox.com/", { SITE_CONTROL: kv("1") }))).status, 200);
	assert.equal((await onRequest(context("https://merulox.com/", { SITE_CONTROL: kv(null) }))).status, 200);
	assert.equal((await onRequest(context("https://merulox.com/"))).status, 200);
	assert.equal(await publicSiteEnabled({ SITE_CONTROL: kv("0", { fail: true }) }), true);
});

test("dev host ignores the switch and keeps its own auth", async () => {
	const env = { SITE_CONTROL: kv("0") };
	assert.equal((await onRequest(context("https://dev.merulox.com/", env))).status, 401);
	const ok = await onRequest(context("https://dev.merulox.com/", env, { headers: { Authorization: `Basic ${btoa("m:secret")}` } }));
	assert.equal(ok.status, 200);
});
