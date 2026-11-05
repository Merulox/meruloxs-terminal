import test from "node:test";
import assert from "node:assert/strict";
import {
	createDraftStore,
	createFocusMemory,
	createLinksController,
	focusDescriptorsMatch,
	normalizeLinksPayload,
	reconcileDraftWithItem,
} from "../src/lib/links-editor.mjs";

const SECTION_IDS = ["contact", "dev", "socials", "crypto", "media", "forums", "misc", "games"];

function item(section, overrides = {}) {
	return {
		id: `${section}-one`,
		section,
		kind: "link",
		label: `${section} one`,
		href: `https://example.com/${section}`,
		visible: true,
		position: SECTION_IDS.indexOf(section),
		custom: false,
		...overrides,
	};
}

function payload(editable, overrides = {}) {
	return {
		editable,
		sections: SECTION_IDS.map((id) => ({ id, label: id, items: [item(id)] })),
		...overrides,
	};
}

function response(body, { ok = true, status = ok ? 200 : 500 } = {}) {
	return { ok, status, async json() { return body; } };
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function harness(fetch, extra = {}) {
	const states = [];
	let intervalCallback = null;
	let cleared = false;
	const controller = createLinksController({
		fetch,
		onState: (state) => states.push(state),
		setInterval(callback) { intervalCallback = callback; return "poll-token"; },
		clearInterval(token) { assert.equal(token, "poll-token"); cleared = true; },
		...extra,
	});
	return { controller, states, poll: () => intervalCallback?.(), wasCleared: () => cleared };
}

function find(state, id) {
	return state.sections.flatMap((section) => section.items).find((entry) => entry.id === id);
}

test("initial public load filters hidden entries while dev load keeps every entry editable", async () => {
	const publicPayload = payload(false);
	publicPayload.sections[1].items.push(item("dev", {
		id: "dev-hidden",
		label: "secret",
		href: "https://example.com/secret",
		visible: false,
		position: 20,
	}));
	const publicHarness = harness(async () => response(publicPayload));
	assert.equal(await publicHarness.controller.load(), true);
	assert.equal(publicHarness.controller.getState().editable, false);
	assert.equal(find(publicHarness.controller.getState(), "dev-hidden"), undefined);
	publicHarness.controller.dispose();

	const devPayload = structuredClone(publicPayload);
	devPayload.editable = true;
	const devHarness = harness(async () => response(devPayload));
	assert.equal(await devHarness.controller.load(), true);
	assert.equal(devHarness.controller.getState().editable, true);
	assert.equal(find(devHarness.controller.getState(), "dev-hidden").visible, false);
	devHarness.controller.dispose();
});

test("toggle, add, and remove merge confirmed mutation results without a refresh GET", async () => {
	const calls = [];
	const custom = item("media", {
		id: "custom-11111111-1111-4111-8111-111111111111",
		label: "New profile",
		href: "https://example.net/new",
		visible: true,
		position: 100,
		custom: true,
	});
	const fetch = async (_url, options = {}) => {
		calls.push(options);
		if (!options.method) return response(payload(true));
		if (options.method === "PATCH") return response({ item: item("dev", { visible: false }) });
		if (options.method === "POST") return response({ item: custom });
		if (options.method === "DELETE") return response({ id: custom.id });
		throw new Error("unexpected request");
	};
	const { controller } = harness(fetch);
	await controller.load();
	assert.equal(await controller.toggle("dev-one", false), true);
	assert.equal(find(controller.getState(), "dev-one").visible, false);
	assert.equal(await controller.add("media", {
		id: custom.id,
		label: custom.label,
		href: custom.href,
		visible: true,
	}), true);
	assert.equal(find(controller.getState(), custom.id).label, "New profile");
	assert.equal(await controller.remove(custom.id), true);
	assert.equal(find(controller.getState(), custom.id), undefined);
	assert.deepEqual(calls.map((call) => call.method ?? "GET"), ["GET", "PATCH", "POST", "DELETE"]);
	controller.dispose();
});

test("an in-flight add blocks duplicates and retry reuses the same UUID and request body", async () => {
	const firstPost = deferred();
	const requests = [];
	let uuidCalls = 0;
	const uuid = "22222222-2222-4222-8222-222222222222";
	const fetch = async (_url, options = {}) => {
		if (!options.method) return response(payload(true));
		requests.push(JSON.parse(options.body));
		if (requests.length === 1) return firstPost.promise;
		return response({ item: item("forums", {
			id: `custom-${uuid}`,
			label: "Forum two",
			href: "https://forum.example/two",
			position: 101,
			custom: true,
		}) });
	};
	const { controller } = harness(fetch, { uuid: () => { uuidCalls += 1; return uuid; } });
	await controller.load();
	const first = controller.add("forums", { label: "Forum two", href: "https://forum.example/two", visible: true });
	assert.equal(await controller.add("forums", { label: "duplicate", href: "https://example.com/duplicate", visible: true }), false);
	assert.equal(requests.length, 1);
	assert.equal(uuidCalls, 1);
	firstPost.reject(new Error("connection ended before confirmation"));
	assert.equal(await first, false);
	assert.equal(controller.getState().canRetry, true);
	assert.equal(await controller.retry(), true);
	assert.equal(requests.length, 2);
	assert.deepEqual(requests[1], requests[0]);
	assert.equal(requests[1].id, `custom-${uuid}`);
	assert.equal(uuidCalls, 1);
	assert.equal(find(controller.getState(), `custom-${uuid}`).label, "Forum two");
	controller.dispose();
});

test("invalid add drafts stay intact and expose actionable validation without a request", async () => {
	let calls = 0;
	const { controller } = harness(async () => {
		calls += 1;
		return response(payload(true));
	});
	await controller.load();
	const draft = {
		id: "custom-44444444-4444-4444-8444-444444444444",
		label: "   ",
		href: "https://example.com/profile",
		visible: true,
	};
	assert.equal(await controller.add("dev", draft), false);
	assert.equal(controller.getState().error, "Name is required.");
	assert.equal(controller.getState().canRetry, false);
	assert.equal(draft.label, "   ");
	assert.equal(draft.id, "custom-44444444-4444-4444-8444-444444444444");
	assert.equal(calls, 1);

	draft.label = "Profile";
	draft.href = "https://example.com/%0a";
	assert.equal(await controller.add("dev", draft), false);
	assert.equal(controller.getState().error, "Enter a valid HTTP(S) or mailto URL without credentials.");
	assert.equal(draft.href, "https://example.com/%0a");
	assert.equal(calls, 1);
	draft.href = "https://user:pass@example.com/profile";
	assert.equal(await controller.add("dev", draft), false);

	assert.equal(controller.getState().error, "Enter a valid HTTP(S) or mailto URL without credentials.");
	assert.equal(draft.href, "https://user:pass@example.com/profile");
	assert.equal(calls, 1);
	controller.dispose();
});
test("confirmed retry retains newer draft fields and clears the consumed UUID", async () => {
	const firstPost = deferred();
	const id = "custom-55555555-5555-4555-8555-555555555555";
	let mutationCalls = 0;
	const { controller } = harness(async (_url, options = {}) => {
		if (!options.method) return response(payload(true));
		mutationCalls += 1;
		if (mutationCalls === 1) return firstPost.promise;
		return response({ item: item("dev", {
			id,
			label: "Original",
			href: "https://example.com/original",
			position: 110,
			custom: true,
		}) });
	});
	await controller.load();
	const draft = { id, label: "Original", href: "https://example.com/original", visible: true };
	const initialAdd = controller.add("dev", draft);
	firstPost.reject(new Error("uncertain response"));
	assert.equal(await initialAdd, false);
	draft.label = "Newer edit";
	draft.href = "https://example.com/newer";
	assert.equal(await controller.retry(), true);
	const confirmed = find(controller.getState(), id);
	assert.equal(reconcileDraftWithItem({
		id,
		label: "Original",
		href: "https://example.com/original",
		visible: true,
	}, confirmed), "close");
	assert.equal(reconcileDraftWithItem(draft, confirmed), "retain");
	assert.equal(draft.label, "Newer edit");
	assert.equal(draft.href, "https://example.com/newer");
	assert.equal(draft.id, null);
	controller.dispose();
});

test("focus descriptors survive pending renders and remove-to-confirm transitions", () => {
	const toggle = { linkId: "dev-one", sectionId: "dev", action: "toggle", name: "" };
	assert.equal(focusDescriptorsMatch(toggle, { ...toggle }), true);
	assert.equal(focusDescriptorsMatch(toggle, { ...toggle, linkId: "dev-two" }), false);
	const remove = { linkId: "custom-one", sectionId: "dev", action: "remove", name: "" };
	assert.equal(focusDescriptorsMatch(remove, { ...remove, action: "confirm-remove" }), true);
	assert.equal(focusDescriptorsMatch({ ...remove, action: "confirm-remove" }, remove), true);
	assert.equal(focusDescriptorsMatch(remove, { ...remove, action: "toggle" }), false);
	const memory = createFocusMemory();
	assert.deepEqual(memory.observe(toggle), toggle);
	assert.deepEqual(memory.observe({ linkId: "", sectionId: "", action: "retry", name: "" }), toggle);
	assert.deepEqual(memory.settle(false, true), toggle);
	assert.deepEqual(memory.observe(null, false), toggle);
	assert.deepEqual(memory.settle(true, false), toggle);
	assert.equal(memory.observe(null, true), null);
});

test("a GET that began before a confirmed mutation cannot overwrite the local result", async () => {
	const lateGet = deferred();
	let call = 0;
	const fetch = async (_url, options = {}) => {
		call += 1;
		if (call === 1) return response(payload(true));
		if (call === 2) return lateGet.promise;
		assert.equal(options.method, "PATCH");
		return response({ item: item("socials", { visible: false }) });
	};
	const { controller } = harness(fetch);
	await controller.load();
	const staleLoad = controller.load({ quiet: true });
	assert.equal(await controller.toggle("socials-one", false), true);
	lateGet.resolve(response(payload(true)));
	assert.equal(await staleLoad, false);
	assert.equal(find(controller.getState(), "socials-one").visible, false);
	controller.dispose();
});

test("navigation abort clears polling, aborts fetch, and ignores a late completion", async () => {
	const pending = deferred();
	const navigation = new AbortController();
	let requestSignal;
	const { controller, states, wasCleared } = harness(async (_url, options) => {
		requestSignal = options.signal;
		return pending.promise;
	}, { signal: navigation.signal });
	const loading = controller.load();
	const emissionsAtAbort = states.length;
	navigation.abort();
	assert.equal(requestSignal.aborted, true);
	assert.equal(wasCleared(), true);
	pending.resolve(response(payload(false)));
	assert.equal(await loading, false);
	assert.equal(states.length, emissionsAtAbort);
	assert.equal(controller.getState().sections.length, 0);
});

test("unknown sections, duplicate IDs, and invalid mutation payloads fail closed", async () => {
	const unknown = payload(false);
	unknown.sections[0] = { id: "unknown", label: "unknown", items: [] };
	assert.throws(() => normalizeLinksPayload(unknown), /Invalid links section|Missing links section/);
	const duplicate = payload(false);
	duplicate.sections[1].items[0].id = duplicate.sections[0].items[0].id;
	assert.throws(() => normalizeLinksPayload(duplicate), /Duplicate link item/);

	let call = 0;
	const { controller } = harness(async (_url, options = {}) => {
		call += 1;
		if (!options.method) return response(payload(true));
		return response({ item: { nope: true } });
	});
	await controller.load();
	const before = controller.getState();
	assert.equal(await controller.toggle("crypto-one", false), false);
	assert.equal(find(controller.getState(), "crypto-one").visible, find(before, "crypto-one").visible);
	assert.equal(controller.getState().canRetry, true);
	assert.equal(call, 2);
	controller.dispose();
});

test("draft store preserves other open forms and assigned retry identity across rerenders", () => {
	const drafts = createDraftStore();
	drafts.open("dev");
	drafts.update("dev", "label", "Code host");
	drafts.update("dev", "href", "https://code.example/me");
	drafts.update("dev", "id", "custom-33333333-3333-4333-8333-333333333333");
	drafts.open("media");
	drafts.update("media", "label", "Listening profile");

	const beforeMutationRender = drafts.snapshot();
	assert.deepEqual(drafts.snapshot(), beforeMutationRender);
	assert.equal(drafts.get("dev").href, "https://code.example/me");
	assert.equal(drafts.get("dev").id, "custom-33333333-3333-4333-8333-333333333333");
	assert.equal(drafts.get("media").label, "Listening profile");
	drafts.close("dev");
	assert.equal(drafts.get("dev"), null);
	assert.equal(drafts.get("media").label, "Listening profile");
});

test("public polling pauses while a form is being edited and dev mode never polls", async () => {
	let calls = 0;
	const publicHarness = harness(async () => { calls += 1; return response(payload(false)); });
	await publicHarness.controller.load();
	publicHarness.controller.setEditing(true);
	publicHarness.poll();
	await Promise.resolve();
	assert.equal(calls, 1);
	publicHarness.controller.setEditing(false);
	publicHarness.poll();
	await Promise.resolve();
	assert.equal(calls, 2);
	publicHarness.controller.dispose();

	let devCalls = 0;
	const devHarness = harness(async () => { devCalls += 1; return response(payload(true)); });
	await devHarness.controller.load();
	devHarness.poll();
	await Promise.resolve();
	assert.equal(devCalls, 1);
	devHarness.controller.dispose();
});
