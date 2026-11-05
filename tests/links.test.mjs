import assert from "node:assert/strict";
import test from "node:test";
import { onRequestDelete, onRequestGet, onRequestPatch, onRequestPost } from "../functions/api/links.js";
import { defaultLinks, linkSections } from "../src/data/links.mjs";

const PREFIX = "links:v1:";
const DEV_URL = "https://dev.merulox.com/api/links";

function uuidFor(number) {
	return `custom-00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function customRecord(id, overrides = {}) {
	return {
		id,
		section: "dev",
		kind: "link",
		label: `Custom ${id.slice(-4)}`,
		href: `https://example.com/${id.slice(-4)}`,
		visible: true,
		position: 1000 + Number(id.slice(-4)),
		custom: true,
		...overrides,
	};
}

function kv(initial = {}, options = {}) {
	const values = new Map(Object.entries({ site_enabled: "0", ...initial }));
	const calls = [];
	return {
		values,
		calls,
		async list({ prefix, cursor, limit }) {
			calls.push(["list", prefix, cursor ?? null, limit]);
			if (options.listError) throw new Error("list failed");
			const names = [...values.keys()].filter((name) => name.startsWith(prefix)).sort();
			const start = cursor ? Number(cursor) : 0;
			const size = Math.min(limit, options.pageSize ?? limit);
			const end = Math.min(start + size, names.length);
			return {
				keys: names.slice(start, end).map((name) => ({ name })),
				list_complete: end >= names.length,
				...(end < names.length ? { cursor: String(end) } : {}),
			};
		},
		async get(key) {
			calls.push(["get", key]);
			if (options.getError) throw new Error("get failed");
			return values.get(key) ?? null;
		},
		async put(key, value) {
			calls.push(["put", key, value]);
			if (options.putError) throw new Error("put failed");
			if (options.putDelay) await new Promise((resolve) => setTimeout(resolve, options.putDelay));
			values.set(key, value);
		},
		async delete(key) {
			calls.push(["delete", key]);
			if (options.deleteError) throw new Error("delete failed");
			values.delete(key);
		},
	};
}

function getContext(store, { url = "https://merulox.com/api/links", data } = {}) {
	return { request: new Request(url), env: { SITE_CONTROL: store }, data };
}

function mutationContext(store, {
	method = "POST",
	url = DEV_URL,
	data = { devAuthenticated: true },
	body,
	headers,
} = {}) {
	const requestHeaders = headers === undefined
		? { "Content-Type": "application/json", Origin: new URL(url).origin }
		: headers;
	return {
		request: new Request(url, {
			method,
			headers: requestHeaders,
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		env: { SITE_CONTROL: store },
		data,
	};
}

async function expectJson(response, status, expected) {
	assert.equal(response.status, status);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.match(response.headers.get("content-type"), /application\/json/);
	const body = await response.json();
	if (expected !== undefined) assert.deepEqual(body, expected);
	else if (status >= 400) assert.equal(typeof body.error, "string");
	return body;
}

function flatten(responseBody) {
	return responseBody.sections.flatMap((section) => section.items);
}

function postBody(id, overrides = {}) {
	return {
		id,
		section: "dev",
		label: "Example",
		href: "https://example.com",
		visible: true,
		...overrides,
	};
}

test("GET seeds all 41 manifest defaults, section order, contact values, addresses, and split pairs", async () => {
	const store = kv();
	const body = await expectJson(await onRequestGet(getContext(store)), 200);
	assert.equal(body.editable, false);
	assert.deepEqual(body.sections.map(({ id, label }) => ({ id, label })), linkSections);
	const items = flatten(body);
	assert.equal(items.length, 41);
	assert.deepEqual(items, defaultLinks);
	assert.deepEqual(items.filter(({ section }) => section === "contact").map(({ kind }) => kind), ["text", "text", "text", "link", "link"]);
	assert.equal(items.find(({ id }) => id === "contact-matrix").value, "@merulox:nitro.chat");
	assert.deepEqual(items.filter(({ kind }) => kind === "address").map(({ label }) => label), ["BTC", "SOL", "ETH"]);
	assert.deepEqual(items.filter(({ pair }) => pair === "fomo").map(({ id }) => id), ["crypto-fomo-profile", "crypto-fomo-referral"]);
	assert.equal(store.values.get("site_enabled"), "0");
	assert.equal(store.calls.some(([method]) => method === "put" || method === "delete"), false);
});

test("public GET omits hidden built-in and custom rows while authenticated dev GET includes all", async () => {
	const hiddenId = uuidFor(1);
	const visibleId = uuidFor(2);
	const store = kv({
		[`${PREFIX}dev-github`]: JSON.stringify({ visible: false }),
		[`${PREFIX}${hiddenId}`]: JSON.stringify(customRecord(hiddenId, { visible: false })),
		[`${PREFIX}${visibleId}`]: JSON.stringify(customRecord(visibleId)),
	});

	const publicBody = await expectJson(await onRequestGet(getContext(store)), 200);
	assert.equal(publicBody.editable, false);
	assert.equal(flatten(publicBody).some(({ id }) => id === "dev-github" || id === hiddenId), false);
	assert.equal(flatten(publicBody).some(({ id }) => id === visibleId), true);

	const devBody = await expectJson(await onRequestGet(getContext(store, { url: DEV_URL, data: { devAuthenticated: true } })), 200);
	assert.equal(devBody.editable, true);
	assert.equal(flatten(devBody).find(({ id }) => id === "dev-github").visible, false);
	assert.equal(flatten(devBody).find(({ id }) => id === hiddenId).visible, false);

	const bearerBody = await expectJson(await onRequestGet({
		...getContext(store, { url: DEV_URL, data: {} }),
		request: new Request(DEV_URL, { headers: { Authorization: "Bearer accepted-by-root-middleware" } }),
	}), 200);
	assert.equal(bearerBody.editable, false);
	assert.equal(flatten(bearerBody).some(({ id }) => id === hiddenId), false);
});

test("all mutations require exact dev host and strict middleware context, not authorization-like headers", async () => {
	const handlers = [
		[onRequestPost, "POST", postBody(uuidFor(10))],
		[onRequestPatch, "PATCH", { id: "dev-github", visible: false }],
		[onRequestDelete, "DELETE", { id: uuidFor(10) }],
	];
	for (const [handler, method, body] of handlers) {
		for (const context of [
			mutationContext(kv(), { method, body, data: {} }),
			mutationContext(kv(), { method, body, data: { devAuthenticated: false } }),
			mutationContext(kv(), { method, body, data: { devAuthenticated: "true" } }),
			mutationContext(kv(), { method, body, data: null, headers: { "Content-Type": "application/json", Origin: "https://dev.merulox.com", Authorization: "Bearer token" } }),
			mutationContext(kv(), { method, body, data: {}, headers: { "Content-Type": "application/json", Origin: "https://dev.merulox.com", Authorization: "Basic dGVzdDp0ZXN0" } }),
			mutationContext(kv(), { method, body, url: "https://merulox.com/api/links", data: { devAuthenticated: true } }),
			mutationContext(kv(), { method, body, url: "https://dev.merulox.com.evil.example/api/links", data: { devAuthenticated: true } }),
		]) {
			await expectJson(await handler(context), 403);
			assert.deepEqual(context.env.SITE_CONTROL.calls, []);
		}
	}
});

test("mutations require an exact, present Origin and JSON content type", async () => {
	const body = postBody(uuidFor(20));
	for (const headers of [
		{ "Content-Type": "application/json" },
		{ "Content-Type": "application/json", Origin: "null" },
		{ "Content-Type": "application/json", Origin: "https://merulox.com" },
		{ "Content-Type": "application/json", Origin: "http://dev.merulox.com" },
		{ "Content-Type": "application/json", Origin: "https://dev.merulox.com:444" },
	]) {
		const store = kv();
		await expectJson(await onRequestPost(mutationContext(store, { body, headers })), 403);
		assert.deepEqual(store.calls, []);
	}
	for (const headers of [
		{ Origin: "https://dev.merulox.com" },
		{ Origin: "https://dev.merulox.com", "Content-Type": "text/plain" },
		{ Origin: "https://dev.merulox.com", "Content-Type": "application/jsonp" },
	]) {
		const store = kv();
		await expectJson(await onRequestPost(mutationContext(store, { body, headers })), 415);
		assert.deepEqual(store.calls, []);
	}
	const store = kv();
	await expectJson(await onRequestPost(mutationContext(store, {
		body,
		headers: { Origin: "https://dev.merulox.com", "Content-Type": "application/json; charset=utf-8" },
	})), 201);
});

test("malformed, oversized, non-object, missing, extra, and wrongly typed mutation bodies are rejected before KV access", async () => {
	const validHeaders = { Origin: "https://dev.merulox.com", "Content-Type": "application/json" };
	for (const body of ["", "{", "null", "[]", "true", '"text"', "1"]) {
		const store = kv();
		await expectJson(await onRequestPost(mutationContext(store, { body, headers: validHeaders })), 400);
		assert.deepEqual(store.calls, []);
	}
	for (const body of [
		{},
		postBody(uuidFor(30), { extra: true }),
		postBody(uuidFor(31), { visible: "true" }),
		postBody("custom-not-a-uuid"),
		postBody(uuidFor(32), { section: "unknown" }),
		postBody(uuidFor(33), { label: "" }),
		postBody(uuidFor(34), { label: ` ${"x".repeat(100)}` }),
		postBody([uuidFor(37)]),
	]) {
		const store = kv();
		await expectJson(await onRequestPost(mutationContext(store, { body, headers: validHeaders })), 400);
		assert.deepEqual(store.calls, []);
	}
	for (const [handler, method, body] of [
		[onRequestPatch, "PATCH", { id: "dev-github", visible: false, label: "replacement" }],
		[onRequestPatch, "PATCH", { id: "dev-github", visible: 0 }],
		[onRequestDelete, "DELETE", { id: uuidFor(30), extra: true }],
	]) {
		const store = kv();
		await expectJson(await handler(mutationContext(store, { method, body })), 400);
		assert.deepEqual(store.calls, []);
	}
	for (const requestOptions of [
		{ body: JSON.stringify(postBody(uuidFor(35), { label: "x".repeat(5000) })) },
		{ body: JSON.stringify(postBody(uuidFor(36))), headers: { ...validHeaders, "Content-Length": "5000" } },
	]) {
		const store = kv();
		await expectJson(await onRequestPost(mutationContext(store, requestOptions)), 413);
		assert.deepEqual(store.calls, []);
	}
});

test("POST reserves enough stored-record space for a later visibility change", async () => {
	const acceptedStore = kv();
	const acceptedId = uuidFor(38);
	const accepted = postBody(acceptedId, { label: "A", href: "https://example.com/" });
	const recordOverhead = new TextEncoder().encode(JSON.stringify({
		...accepted, kind: "link", position: Date.now(), custom: true,
	})).byteLength;
	const padding = 4095 - recordOverhead;
	accepted.href += "é".repeat(Math.floor(padding / 2)) + "a".repeat(padding % 2);
	assert.equal(new TextEncoder().encode(JSON.stringify(accepted)).byteLength <= 4096, true);
	await expectJson(await onRequestPost(mutationContext(acceptedStore, { body: accepted })), 201);
	await expectJson(await onRequestPatch(mutationContext(acceptedStore, {
		method: "PATCH",
		body: { id: acceptedId, visible: false },
	})), 200);

	const rejectedStore = kv();
	const rejected = postBody(uuidFor(39), { label: "A", href: `${accepted.href}a` });
	assert.equal(new TextEncoder().encode(JSON.stringify(rejected)).byteLength <= 4096, true);
	await expectJson(await onRequestPost(mutationContext(rejectedStore, { body: rejected })), 413);
	assert.equal(rejectedStore.calls.some(([method]) => method === "put"), false);
});

test("POST accepts only unambiguous http, https, and mailto URLs without credentials or controls", async () => {
	const valid = [
		"https://example.com/path?x=1#fragment",
		"http://example.com:8080/path",
		"mailto:user@example.com",
		"mailto:user@example.com?subject=Hello",
	];
	for (let index = 0; index < valid.length; index += 1) {
		const store = kv();
		const response = await onRequestPost(mutationContext(store, { body: postBody(uuidFor(40 + index), { href: valid[index] }) }));
		const result = await expectJson(response, 201);
		assert.equal(result.item.href, valid[index]);
	}

	const invalid = [
		"javascript:alert(1)",
		"data:text/html,test",
		"ftp://example.com/file",
		"https://user:password@example.com",
		"https:example.com",
		"//example.com/path",
		"https://example.com\\@evil.example",
		"https://example.com/%0aheader",
		"https://example.com/has space",
		" https://example.com",
		"mailto:user",
		"mailto://user@example.com",
		"mailto:user@example.com#fragment",
		"mailto:user@example.com?subject=%0dtest",
		"not a url",
	];
	for (let index = 0; index < invalid.length; index += 1) {
		const store = kv();
		await expectJson(await onRequestPost(mutationContext(store, {
			body: postBody(uuidFor(50 + index), { href: invalid[index] }),
		})), 400);
		assert.deepEqual(store.calls, []);
	}
});

test("hidden and visible custom links can be added independently in every section", async () => {
	const store = kv();
	const created = [];
	let number = 100;
	for (const section of linkSections) {
		for (const visible of [true, false]) {
			const id = uuidFor(number++);
			const result = await expectJson(await onRequestPost(mutationContext(store, {
				body: postBody(id, { section: section.id, label: `${section.label}-${visible}`, visible }),
			})), 201);
			assert.equal(result.item.kind, "link");
			assert.equal(result.item.custom, true);
			assert.equal(result.item.position > 40, true);
			created.push(result.item);
		}
	}
	assert.equal(new Set(created.map(({ position }) => position)).size, created.length);
	assert.equal(store.values.get("site_enabled"), "0");

	const publicBody = await expectJson(await onRequestGet(getContext(store)), 200);
	for (const section of publicBody.sections) {
		const custom = section.items.filter(({ custom }) => custom);
		assert.equal(custom.length, 1);
		assert.equal(custom[0].visible, true);
	}
	const devBody = await expectJson(await onRequestGet(getContext(store, { url: DEV_URL, data: { devAuthenticated: true } })), 200);
	for (const section of devBody.sections) {
		assert.deepEqual(section.items.filter(({ custom }) => custom).map(({ visible }) => visible), [true, false]);
	}
});

test("POST retries are idempotent and conflicting same-ID payloads return 409", async () => {
	const store = kv();
	const body = postBody(uuidFor(200));
	const first = await expectJson(await onRequestPost(mutationContext(store, { body })), 201);
	const retry = await expectJson(await onRequestPost(mutationContext(store, { body })), 200);
	assert.deepEqual(retry.item, first.item);
	await expectJson(await onRequestPost(mutationContext(store, { body: { ...body, href: "https://different.example" } })), 409);
	assert.equal(store.calls.filter(([method]) => method === "put").length, 1);
	assert.equal(store.values.get("site_enabled"), "0");
});

test("same-entry concurrent POSTs serialize while independent concurrent mutations keep separate keys", async () => {
	const store = kv({}, { putDelay: 5 });
	const sharedId = uuidFor(210);
	const [first, conflict] = await Promise.all([
		onRequestPost(mutationContext(store, { body: postBody(sharedId) })),
		onRequestPost(mutationContext(store, { body: postBody(sharedId, { label: "Conflict" }) })),
	]);
	assert.deepEqual([first.status, conflict.status], [201, 409]);

	const idA = uuidFor(211);
	const idB = uuidFor(212);
	const responses = await Promise.all([
		onRequestPost(mutationContext(store, { body: postBody(idA) })),
		onRequestPost(mutationContext(store, { body: postBody(idB) })),
		onRequestPatch(mutationContext(store, { method: "PATCH", body: { id: "dev-github", visible: false } })),
		onRequestPatch(mutationContext(store, { method: "PATCH", body: { id: "games-steam", visible: false } })),
	]);
	assert.deepEqual(responses.map(({ status }) => status), [201, 201, 200, 200]);
	for (const id of [sharedId, idA, idB, "dev-github", "games-steam"]) assert.equal(store.values.has(`${PREFIX}${id}`), true);
	assert.equal(store.values.has(PREFIX), false);
	assert.equal(store.values.get("site_enabled"), "0");
});

test("PATCH stores minimal built-in visibility overrides and complete custom records", async () => {
	const store = kv();
	const hidden = await expectJson(await onRequestPatch(mutationContext(store, {
		method: "PATCH",
		body: { id: "contact-email", visible: false },
	})), 200);
	assert.equal(hidden.item.label, "email");
	assert.equal(hidden.item.href, "mailto:web@merulox.com");
	assert.equal(store.values.get(`${PREFIX}contact-email`), '{"visible":false}');

	await expectJson(await onRequestPatch(mutationContext(store, {
		method: "PATCH",
		body: { id: "contact-email", visible: true },
	})), 200);
	assert.equal(store.values.has(`${PREFIX}contact-email`), false);

	const customId = uuidFor(220);
	const created = await expectJson(await onRequestPost(mutationContext(store, { body: postBody(customId) })), 201);
	const patched = await expectJson(await onRequestPatch(mutationContext(store, {
		method: "PATCH",
		body: { id: customId, visible: false },
	})), 200);
	assert.deepEqual(patched.item, { ...created.item, visible: false });
	assert.deepEqual(Object.keys(JSON.parse(store.values.get(`${PREFIX}${customId}`))).sort(), [
		"custom", "href", "id", "kind", "label", "position", "section", "visible",
	]);
	await expectJson(await onRequestPatch(mutationContext(store, {
		method: "PATCH",
		body: { id: uuidFor(221), visible: false },
	})), 404);
});

test("GET fully paginates and applies visibility records found on later pages", async () => {
	const customA = uuidFor(230);
	const customB = uuidFor(231);
	const store = kv({
		[`${PREFIX}contact-discord`]: JSON.stringify({ visible: false }),
		[`${PREFIX}games-steam`]: JSON.stringify({ visible: false }),
		[`${PREFIX}${customA}`]: JSON.stringify(customRecord(customA, { position: 1230 })),
		[`${PREFIX}${customB}`]: JSON.stringify(customRecord(customB, { section: "games", position: 1231 })),
	}, { pageSize: 1 });
	const body = await expectJson(await onRequestGet(getContext(store)), 200);
	const ids = new Set(flatten(body).map(({ id }) => id));
	assert.equal(ids.has("contact-discord"), false);
	assert.equal(ids.has("games-steam"), false);
	assert.equal(ids.has(customA), true);
	assert.equal(ids.has(customB), true);
	assert.equal(store.calls.filter(([method]) => method === "list").length, 4);
});

test("GET fails closed when the bounded record limit is exceeded", async () => {
	const initial = {};
	for (let number = 1000; number < 1257; number += 1) {
		const id = uuidFor(number);
		initial[`${PREFIX}${id}`] = JSON.stringify(customRecord(id, { position: 2000 + number }));
	}
	const store = kv(initial);
	await expectJson(await onRequestGet(getContext(store)), 503);
	assert.equal(store.calls.some(([method]) => method === "get"), false);
});

test("mutations reject new keys at collection capacity instead of making GET unreadable", async () => {
	const initial = {};
	for (let number = 3000; number < 3256; number += 1) {
		const id = uuidFor(number);
		initial[`${PREFIX}${id}`] = JSON.stringify(customRecord(id, { position: 5000 + number }));
	}
	const postStore = kv(initial);
	await expectJson(await onRequestPost(mutationContext(postStore, { body: postBody(uuidFor(4000)) })), 409);
	assert.equal(postStore.values.has(`${PREFIX}${uuidFor(4000)}`), false);

	const patchStore = kv(initial);
	await expectJson(await onRequestPatch(mutationContext(patchStore, {
		method: "PATCH",
		body: { id: "dev-github", visible: false },
	})), 409);
	assert.equal(patchStore.values.has(`${PREFIX}dev-github`), false);
});

test("KV listing, reads, malformed records, unknown overrides, and missing listed values return 503", async () => {
	const malformedCases = [
		{ [`${PREFIX}dev-github`]: "{" },
		{ [`${PREFIX}dev-github`]: JSON.stringify({ visible: false, label: "leak" }) },
		{ [`${PREFIX}unknown-default`]: JSON.stringify({ visible: false }) },
		{ [`${PREFIX}${uuidFor(240)}`]: JSON.stringify(customRecord(uuidFor(240), { section: "unknown" })) },
		{ [`${PREFIX}${uuidFor(241)}`]: JSON.stringify(customRecord(uuidFor(241), { id: uuidFor(242) })) },
		{ [`${PREFIX}${uuidFor(243)}`]: "x".repeat(4097) },
	];
	for (const initial of malformedCases) await expectJson(await onRequestGet(getContext(kv(initial))), 503);
	await expectJson(await onRequestGet(getContext(kv({}, { listError: true }))), 503);
	await expectJson(await onRequestGet(getContext(kv({ [`${PREFIX}dev-github`]: JSON.stringify({ visible: false }) }, { getError: true }))), 503);

	const invalidListStore = kv();
	invalidListStore.list = async () => ({ keys: [], list_complete: false, cursor: "same" });
	await expectJson(await onRequestGet(getContext(invalidListStore)), 503);

	const missingStore = kv();
	missingStore.list = async () => ({ keys: [{ name: `${PREFIX}dev-github` }], list_complete: true });
	await expectJson(await onRequestGet(getContext(missingStore)), 503);
});

test("missing or incomplete SITE_CONTROL bindings and KV mutation failures return 503 without false success", async () => {
	for (const env of [undefined, {}, { SITE_CONTROL: null }, { SITE_CONTROL: { get() {} } }]) {
		await expectJson(await onRequestGet({ request: new Request("https://merulox.com/api/links"), env }), 503);
	}
	const postStore = kv({}, { getError: true });
	await expectJson(await onRequestPost(mutationContext(postStore, { body: postBody(uuidFor(250)) })), 503);
	assert.equal(postStore.values.has(`${PREFIX}${uuidFor(250)}`), false);

	const patchStore = kv({}, { putError: true });
	await expectJson(await onRequestPatch(mutationContext(patchStore, {
		method: "PATCH",
		body: { id: "dev-github", visible: false },
	})), 503);
	assert.equal(patchStore.values.has(`${PREFIX}dev-github`), false);

	const deleteId = uuidFor(251);
	const deleteStore = kv({ [`${PREFIX}${deleteId}`]: JSON.stringify(customRecord(deleteId)) }, { deleteError: true });
	await expectJson(await onRequestDelete(mutationContext(deleteStore, { method: "DELETE", body: { id: deleteId } })), 503);
	assert.equal(deleteStore.values.has(`${PREFIX}${deleteId}`), true);
	for (const store of [postStore, patchStore, deleteStore]) assert.equal(store.values.get("site_enabled"), "0");
});

test("DELETE removes only custom links, is retry-safe, and denies built-in deletion", async () => {
	const id = uuidFor(260);
	const store = kv({ [`${PREFIX}${id}`]: JSON.stringify(customRecord(id)) });
	await expectJson(await onRequestDelete(mutationContext(store, { method: "DELETE", body: { id } })), 200, { id });
	assert.equal(store.values.has(`${PREFIX}${id}`), false);
	await expectJson(await onRequestDelete(mutationContext(store, { method: "DELETE", body: { id } })), 200, { id });
	assert.equal(store.calls.filter(([method, key]) => method === "delete" && key === `${PREFIX}${id}`).length, 2);

	await expectJson(await onRequestDelete(mutationContext(store, {
		method: "DELETE",
		body: { id: "dev-github" },
	})), 400);
	assert.equal(store.calls.some(([method, key]) => method === "delete" && key === `${PREFIX}dev-github`), false);
	assert.equal(store.values.get("site_enabled"), "0");
});
