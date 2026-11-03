import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, onRequestPatch } from "../functions/api/moodboard.js";

function kv(initial = {}) {
	const values = new Map(Object.entries({ site_enabled: "0", ...initial }));
	const calls = [];
	return {
		values, calls,
		async get(key) { calls.push(["get", key]); return values.get(key) ?? null; },
		async put(key, value) { calls.push(["put", key, value]); values.set(key, value); },
	};
}

function patchContext(store, { url = "https://dev.merulox.com/api/moodboard", data = { devAuthenticated: true }, body = '{"enabled":false}', headers = { "Content-Type": "application/json" } } = {}) {
	return { request: new Request(url, { method: "PATCH", headers, body }), env: { SITE_CONTROL: store }, data };
}

async function expectResponse(response, status, body) {
	assert.equal(response.status, status);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.match(response.headers.get("content-type"), /application\/json/);
	const parsed = await response.json();
	if (body) assert.deepEqual(parsed, body);
	else assert.equal(typeof parsed.error, "string");
}

for (const [value, enabled] of [[null, true], ["0", false], ["1", true]]) {
	test(`GET reads ${value} as enabled=${enabled} without changing site_enabled`, async () => {
		const store = kv(value === null ? {} : { moodboard_enabled: value });
		await expectResponse(await onRequestGet({ env: { SITE_CONTROL: store } }), 200, { enabled });
		assert.deepEqual(store.calls, [["get", "moodboard_enabled"]]);
		assert.equal(store.values.get("site_enabled"), "0");
	});
}

test("PATCH persists off/on and returns requested state without a stale KV reread", async () => {
	const store = kv();
	for (const enabled of [false, true]) {
		await expectResponse(await onRequestPatch(patchContext(store, { body: JSON.stringify({ enabled }) })), 200, { enabled });
		assert.equal(store.values.get("moodboard_enabled"), enabled ? "1" : "0");
		assert.equal(store.values.get("site_enabled"), "0");
	}
	assert.deepEqual(store.calls, [["put", "moodboard_enabled", "0"], ["put", "moodboard_enabled", "1"]]);
});

test("PATCH requires the exact dev hostname even with forged authenticated context", async () => {
	for (const host of ["merulox.com", "www.merulox.com", "preview.merulox.pages.dev", "localhost", "dev.merulox.com.evil.example"]) {
		const store = kv();
		await expectResponse(await onRequestPatch(patchContext(store, { url: `https://${host}/api/moodboard` })), 403);
		assert.deepEqual(store.calls, []);
	}
});

test("PATCH requires strict middleware authentication and does not accept Bearer or Basic headers alone", async () => {
	for (const data of [{}, { devAuthenticated: false }, { devAuthenticated: "true" }, { devAuthenticated: 1 }, null]) {
		for (const authorization of ["Bearer test-token", "Basic dGVzdDp0ZXN0"]) {
			const store = kv();
			await expectResponse(await onRequestPatch(patchContext(store, { data, headers: { "Content-Type": "application/json", Authorization: authorization } })), 403);
			assert.deepEqual(store.calls, []);
		}
	}
});

test("PATCH accepts absent/same Origin and rejects cross-origin or null Origin", async () => {
	for (const origin of [undefined, "https://dev.merulox.com", "https://merulox.com", "https://evil.example", "http://dev.merulox.com", "https://dev.merulox.com:444", "null", ""]) {
		const store = kv();
		const headers = { "Content-Type": "application/json; charset=utf-8" };
		if (origin !== undefined) headers.Origin = origin;
		const allowed = origin === undefined || origin === "https://dev.merulox.com";
		await expectResponse(await onRequestPatch(patchContext(store, { headers })), allowed ? 200 : 403, allowed ? { enabled: false } : undefined);
		assert.equal(store.calls.length, allowed ? 1 : 0);
	}
});

test("PATCH rejects missing/wrong content types before writing", async () => {
	for (const contentType of [undefined, "text/plain", "application/jsonp", "application/x-www-form-urlencoded"]) {
		const store = kv();
		const headers = contentType ? { "Content-Type": contentType } : {};
		await expectResponse(await onRequestPatch(patchContext(store, { headers })), 415);
		assert.deepEqual(store.calls, []);
	}
});

test("PATCH rejects malformed JSON and non-object/non-boolean bodies", async () => {
	for (const body of ["", "{", "null", "[]", "true", '"text"', "1", "{}", '{"enabled":"false"}', '{"enabled":0}', '{"enabled":null}', '[{"enabled":true}]']) {
		const store = kv();
		await expectResponse(await onRequestPatch(patchContext(store, { body })), 400);
		assert.deepEqual(store.calls, []);
	}
});

test("missing SITE_CONTROL binding returns 503 on reads and authenticated writes", async () => {
	for (const env of [undefined, {}, { SITE_CONTROL: null }]) {
		await expectResponse(await onRequestGet({ env }), 503);
		await expectResponse(await onRequestPatch({ ...patchContext(null), env }), 503);
	}
});

test("KV read errors and invalid stored state return 503", async () => {
	await expectResponse(await onRequestGet({ env: { SITE_CONTROL: { async get() { throw new Error("KV unavailable"); } } } }), 503);
	for (const value of ["", "true", "false", "unexpected"]) {
		await expectResponse(await onRequestGet({ env: { SITE_CONTROL: kv({ moodboard_enabled: value }) } }), 503);
	}
});

test("failed KV writes return 503 without reporting success or touching site_enabled", async () => {
	const store = kv({ moodboard_enabled: "1" });
	store.put = async (key, value) => { store.calls.push(["put", key, value]); throw new Error("KV unavailable"); };
	await expectResponse(await onRequestPatch(patchContext(store)), 503);
	assert.deepEqual(store.calls, [["put", "moodboard_enabled", "0"]]);
	assert.equal(store.values.get("moodboard_enabled"), "1");
	assert.equal(store.values.get("site_enabled"), "0");
});
