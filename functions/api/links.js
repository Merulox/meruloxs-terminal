import { defaultLinks, linkSections } from "../../src/data/links.mjs";

const DEV_HOST = "dev.merulox.com";
const KEY_PREFIX = "links:v1:";
const MAX_BODY_BYTES = 4096;
const MAX_STORED_RECORD_BYTES = 4096;
const MAX_RECORDS = 256;
const MAX_LIST_PAGES = 64;
const LIST_LIMIT = MAX_RECORDS + 1;
const READ_BATCH_SIZE = 16;
const MAX_LABEL_LENGTH = 100;
const MAX_HREF_LENGTH = 2048;
const MAX_ID_LENGTH = 100;
const CUSTOM_ID = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_CONTROL_CHARACTERS = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const BUILTIN_FIELDS = new Set(["visible"]);
const CUSTOM_FIELDS = new Set(["id", "section", "kind", "label", "href", "visible", "position", "custom"]);
const POST_FIELDS = new Set(["id", "section", "label", "href", "visible"]);
const PATCH_FIELDS = new Set(["id", "visible"]);
const DELETE_FIELDS = new Set(["id"]);
const sectionIds = new Set(linkSections.map(({ id }) => id));
const defaultsById = new Map(defaultLinks.map((item) => [item.id, item]));
const lastDefaultPosition = Math.max(...defaultLinks.map(({ position }) => position));
const entryLocks = new Map();
let lastIssuedPosition = lastDefaultPosition;

function json(body, status = 200) {
	return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function unavailable() {
	return json({ error: "Links state unavailable" }, 503);
}

function isPlainObject(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function hasExactFields(value, expected) {
	if (!isPlainObject(value)) return false;
	const keys = Object.keys(value);
	return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function validLabel(label) {
	return typeof label === "string"
		&& label.length >= 1
		&& label.length <= MAX_LABEL_LENGTH
		&& label === label.trim()
		&& !CONTROL_CHARACTERS.test(label);
}

function validHref(href) {
	if (typeof href !== "string" || href.length < 1 || href.length > MAX_HREF_LENGTH) return false;
	if (href !== href.trim() || CONTROL_CHARACTERS.test(href) || /\s|\\/.test(href) || ENCODED_CONTROL_CHARACTERS.test(href)) return false;

	let parsed;
	try {
		parsed = new URL(href);
	} catch {
		return false;
	}

	if (parsed.protocol === "http:" || parsed.protocol === "https:") {
		return /^https?:\/\//i.test(href)
			&& parsed.hostname.length > 0
			&& parsed.username === ""
			&& parsed.password === "";
	}
	if (parsed.protocol === "mailto:") {
		if (!/^mailto:/i.test(href) || href.slice(7).startsWith("//") || parsed.hash) return false;
		const address = href.slice(7).split("?", 1)[0];
		return /^[^@\s/?#]+@[^@\s/?#]+$/.test(address);
	}
	return false;
}

function validMutationId(id) {
	return typeof id === "string"
		&& id.length >= 1
		&& id.length <= MAX_ID_LENGTH
		&& id === id.trim()
		&& !CONTROL_CHARACTERS.test(id);
}

function isDevAuthenticated(request, data) {
	if (data?.devAuthenticated !== true || !request) return false;
	try {
		return new URL(request.url).hostname === DEV_HOST;
	} catch {
		return false;
	}
}

function authorizeMutation(request, data) {
	if (!isDevAuthenticated(request, data)) return json({ error: "Forbidden" }, 403);
	const url = new URL(request.url);
	if (request.headers.get("Origin") !== url.origin) return json({ error: "Forbidden" }, 403);
	return null;
}

async function readJsonBody(request) {
	const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
	if (contentType !== "application/json") return { response: json({ error: "Expected application/json" }, 415) };

	const contentLength = request.headers.get("Content-Length");
	if (contentLength !== null) {
		const length = Number(contentLength);
		if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) {
			return { response: json({ error: "Request body too large" }, 413) };
		}
	}

	let text = "";
	let byteLength = 0;
	let reader;
	try {
		reader = request.body?.getReader();
		if (reader) {
			const decoder = new TextDecoder("utf-8", { fatal: true });
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				byteLength += value.byteLength;
				if (byteLength > MAX_BODY_BYTES) {
					await reader.cancel().catch(() => {});
					return { response: json({ error: "Request body too large" }, 413) };
				}
				text += decoder.decode(value, { stream: true });
			}
			text += decoder.decode();
		}
	} catch {
		return { response: json({ error: "Invalid JSON body" }, 400) };
	}

	try {
		return { body: JSON.parse(text) };
	} catch {
		return { response: json({ error: "Invalid JSON body" }, 400) };
	}
}

function validBuiltinRecord(record) {
	return hasExactFields(record, BUILTIN_FIELDS) && typeof record.visible === "boolean";
}

function validCustomRecord(record, id) {
	return hasExactFields(record, CUSTOM_FIELDS)
		&& record.id === id
		&& CUSTOM_ID.test(record.id)
		&& sectionIds.has(record.section)
		&& record.kind === "link"
		&& validLabel(record.label)
		&& validHref(record.href)
		&& typeof record.visible === "boolean"
		&& Number.isSafeInteger(record.position)
		&& record.position > lastDefaultPosition
		&& record.custom === true;
}

function parseStoredRecord(id, raw) {
	if (typeof raw !== "string" || new TextEncoder().encode(raw).byteLength > MAX_STORED_RECORD_BYTES) throw new Error("Invalid stored record");
	let record;
	try {
		record = JSON.parse(raw);
	} catch {
		throw new Error("Invalid stored record");
	}
	if (defaultsById.has(id)) {
		if (!validBuiltinRecord(record)) throw new Error("Invalid stored record");
		return { ...defaultsById.get(id), visible: record.visible };
	}
	if (!validCustomRecord(record, id)) throw new Error("Invalid stored record");
	return record;
}

function keyFor(id) {
	return `${KEY_PREFIX}${id}`;
}

function bindingSupports(env, methods) {
	return env?.SITE_CONTROL && methods.every((method) => typeof env.SITE_CONTROL[method] === "function");
}

async function readEntry(store, id) {
	const raw = await store.get(keyFor(id));
	return raw === null ? null : parseStoredRecord(id, raw);
}

async function listStoredIds(store) {
	const ids = [];
	const seenKeys = new Set();
	const seenCursors = new Set();
	let cursor;

	for (let pageNumber = 0; pageNumber < MAX_LIST_PAGES; pageNumber += 1) {
		const options = { prefix: KEY_PREFIX, limit: LIST_LIMIT };
		if (cursor) options.cursor = cursor;
		const page = await store.list(options);
		if (!isPlainObject(page) || !Array.isArray(page.keys) || typeof page.list_complete !== "boolean") {
			throw new Error("Invalid KV listing");
		}
		for (const entry of page.keys) {
			if (!isPlainObject(entry) || typeof entry.name !== "string" || !entry.name.startsWith(KEY_PREFIX) || seenKeys.has(entry.name)) {
				throw new Error("Invalid KV listing");
			}
			seenKeys.add(entry.name);
			ids.push(entry.name.slice(KEY_PREFIX.length));
			if (ids.length > MAX_RECORDS) throw new Error("Too many stored records");
		}
		if (page.list_complete) return ids;
		if (typeof page.cursor !== "string" || page.cursor.length === 0 || seenCursors.has(page.cursor)) {
			throw new Error("Invalid KV cursor");
		}
		seenCursors.add(page.cursor);
		cursor = page.cursor;
	}
	throw new Error("Too many KV pages");
}

async function listStoredItems(store) {
	const ids = await listStoredIds(store);
	const items = [];
	for (let offset = 0; offset < ids.length; offset += READ_BATCH_SIZE) {
		const batch = ids.slice(offset, offset + READ_BATCH_SIZE);
		const values = await Promise.all(batch.map((id) => store.get(keyFor(id))));
		for (let index = 0; index < batch.length; index += 1) {
			if (values[index] === null) throw new Error("Listed KV record is missing");
			items.push(parseStoredRecord(batch[index], values[index]));
		}
	}
	return items;
}

function mergeItems(storedItems) {
	const byId = new Map(defaultLinks.map((item) => [item.id, item]));
	for (const item of storedItems) byId.set(item.id, item);
	return [...byId.values()].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

function groupedResponse(items, editable) {
	return {
		editable,
		sections: linkSections.map(({ id, label }) => ({
			id,
			label,
			items: items.filter((item) => item.section === id && (editable || item.visible)),
		})),
	};
}

async function withEntryLock(id, operation) {
	const previous = entryLocks.get(id) ?? Promise.resolve();
	let release;
	const current = new Promise((resolve) => { release = resolve; });
	entryLocks.set(id, current);
	await previous.catch(() => {});
	try {
		return await operation();
	} finally {
		release();
		if (entryLocks.get(id) === current) entryLocks.delete(id);
	}
}

function nextPosition() {
	lastIssuedPosition = Math.max(lastIssuedPosition + 1, Date.now(), lastDefaultPosition + 1);
	return lastIssuedPosition;
}

function serializeRecord(record, reserveBytes = 0) {
	const serialized = JSON.stringify(record);
	return new TextEncoder().encode(serialized).byteLength + reserveBytes <= MAX_STORED_RECORD_BYTES ? serialized : null;
}

function sameCustomPayload(item, body) {
	return item.id === body.id
		&& item.section === body.section
		&& item.label === body.label
		&& item.href === body.href
		&& item.visible === body.visible;
}

export async function onRequestGet({ request, env, data } = {}) {
	if (!bindingSupports(env, ["list", "get"])) return unavailable();
	try {
		const editable = isDevAuthenticated(request, data);
		const items = mergeItems(await listStoredItems(env.SITE_CONTROL));
		return json(groupedResponse(items, editable));
	} catch {
		return unavailable();
	}
}

export async function onRequestPost({ request, env, data }) {
	const authError = authorizeMutation(request, data);
	if (authError) return authError;
	const parsed = await readJsonBody(request);
	if (parsed.response) return parsed.response;
	const body = parsed.body;
	if (!hasExactFields(body, POST_FIELDS)
		|| typeof body.id !== "string"
		|| !CUSTOM_ID.test(body.id)
		|| !sectionIds.has(body.section)
		|| !validLabel(body.label)
		|| !validHref(body.href)
		|| typeof body.visible !== "boolean") {
		return json({ error: "Invalid link" }, 400);
	}
	if (!bindingSupports(env, ["get", "put", "list"])) return unavailable();

	return withEntryLock(body.id, async () => {
		try {
			const existing = await readEntry(env.SITE_CONTROL, body.id);
			if (existing) {
				if (!sameCustomPayload(existing, body)) return json({ error: "Link ID already exists" }, 409);
				return json({ item: existing });
			}
			return await withEntryLock("__capacity__", async () => {
				const ids = await listStoredIds(env.SITE_CONTROL);
				if (ids.includes(body.id)) return unavailable();
				if (ids.length >= MAX_RECORDS) return json({ error: "Link capacity reached" }, 409);
				const item = {
					id: body.id,
					section: body.section,
					kind: "link",
					label: body.label,
					href: body.href,
					visible: body.visible,
					position: nextPosition(),
					custom: true,
				};
				const serialized = serializeRecord(item, 1);
				if (serialized === null) return json({ error: "Link is too large" }, 413);
				await env.SITE_CONTROL.put(keyFor(body.id), serialized);
				return json({ item }, 201);
			});
		} catch {
			return unavailable();
		}
	});
}

export async function onRequestPatch({ request, env, data }) {
	const authError = authorizeMutation(request, data);
	if (authError) return authError;
	const parsed = await readJsonBody(request);
	if (parsed.response) return parsed.response;
	const body = parsed.body;
	if (!hasExactFields(body, PATCH_FIELDS) || !validMutationId(body.id) || typeof body.visible !== "boolean") {
		return json({ error: "Invalid visibility update" }, 400);
	}
	if (!defaultsById.has(body.id) && !CUSTOM_ID.test(body.id)) return json({ error: "Link not found" }, 404);
	if (!bindingSupports(env, ["get", "put", "delete", "list"])) return unavailable();

	return withEntryLock(body.id, async () => {
		try {
			const existing = await readEntry(env.SITE_CONTROL, body.id);
			if (defaultsById.has(body.id)) {
				if (body.visible === defaultsById.get(body.id).visible) {
					await env.SITE_CONTROL.delete(keyFor(body.id));
				} else if (existing) {
					await env.SITE_CONTROL.put(keyFor(body.id), JSON.stringify({ visible: body.visible }));
				} else {
					return await withEntryLock("__capacity__", async () => {
						const ids = await listStoredIds(env.SITE_CONTROL);
						if (ids.includes(body.id)) return unavailable();
						if (ids.length >= MAX_RECORDS) return json({ error: "Link capacity reached" }, 409);
						await env.SITE_CONTROL.put(keyFor(body.id), JSON.stringify({ visible: body.visible }));
						return json({ item: { ...defaultsById.get(body.id), visible: body.visible } });
					});
				}
				return json({ item: { ...defaultsById.get(body.id), visible: body.visible } });
			}
			if (!existing) return json({ error: "Link not found" }, 404);
			const item = { ...existing, visible: body.visible };
			const serialized = serializeRecord(item);
			if (serialized === null) return unavailable();
			await env.SITE_CONTROL.put(keyFor(body.id), serialized);
			return json({ item });
		} catch {
			return unavailable();
		}
	});
}

export async function onRequestDelete({ request, env, data }) {
	const authError = authorizeMutation(request, data);
	if (authError) return authError;
	const parsed = await readJsonBody(request);
	if (parsed.response) return parsed.response;
	const body = parsed.body;
	if (!hasExactFields(body, DELETE_FIELDS) || !validMutationId(body.id)) return json({ error: "Invalid delete request" }, 400);
	if (defaultsById.has(body.id)) return json({ error: "Built-in links cannot be deleted" }, 400);
	if (!CUSTOM_ID.test(body.id)) return json({ error: "Link not found" }, 404);
	if (!bindingSupports(env, ["get", "delete"])) return unavailable();

	return withEntryLock(body.id, async () => {
		try {
			await readEntry(env.SITE_CONTROL, body.id);
			await env.SITE_CONTROL.delete(keyFor(body.id));
			return json({ id: body.id });
		} catch {
			return unavailable();
		}
	});
}
