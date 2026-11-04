import assert from "node:assert/strict";
import test from "node:test";
import { installVisitLifecycle, privacyOptedOut, sendWithFallback } from "../src/lib/visits-client-runtime.js";
import { outboundDestination } from "../src/lib/outbound-destination.js";

function fixture({ beacon = true, storageThrows = false, storageGetterThrows = false, optOut = false } = {}) {
	const listeners = new Map();
	const sent = [];
	const fetched = [];
	const fingerprints = [];
	let devTabs = 0;
	const location = { hostname: "merulox.com", pathname: "/" };
	const document = {
		referrer: "https://google.com/search?q=secret",
		addEventListener(type, handler) {
			listeners.set(type, [...(listeners.get(type) ?? []), handler]);
		},
	};
	const values = new Map();
	const browser = {
		document,
		location,
		navigator: {
			sendBeacon(endpoint, blob) {
				if (beacon === "throw") throw new Error("disabled");
				sent.push({ endpoint, blob });
				return beacon;
			},
		},
		sessionStorage: {
			getItem(key) {
				if (storageThrows) throw new Error("disabled");
				return values.get(key) ?? null;
			},
			setItem(key, value) {
				if (storageThrows) throw new Error("disabled");
				values.set(key, value);
			},
		},
		Blob,
		fetch(endpoint, init) {
			fetched.push({ endpoint, ...init });
			return Promise.resolve();
		},
	};
	if (storageGetterThrows) {
		Object.defineProperty(browser, "sessionStorage", {
			get() { throw new DOMException("Storage blocked", "SecurityError"); },
		});
	}
	installVisitLifecycle({
		browser,
		optedOut: () => optOut,
		addDevTabs: () => devTabs++,
		sendFingerprint: (path) => fingerprints.push(path),
	});
	const dispatch = (type, event = {}) => {
		for (const handler of listeners.get(type) ?? []) handler({ type, button: 0, ...event });
	};
	return { browser, dispatch, fetched, fingerprints, get devTabs() { return devTabs; }, location, sent };
}

async function bodies(events) {
	return Promise.all(events.map(async ({ endpoint, blob }) => ({ endpoint, body: JSON.parse(await blob.text()) })));
}

for (const mode of [false, "throw"]) {
	test(`sendBeacon ${mode} falls back to keepalive fetch`, () => {
		const state = fixture({ beacon: mode });
		state.dispatch("astro:page-load");
		assert.deepEqual(state.fetched.map(({ endpoint, method, keepalive }) => ({ endpoint, method, keepalive })), [
			{ endpoint: "/api/visit", method: "POST", keepalive: true },
		]);
	});
}

test("sendBeacon true does not duplicate through fetch", () => {
	const browser = { navigator: { sendBeacon: () => true }, Blob, fetch: () => assert.fail("fetch called") };
	sendWithFallback("/x", { ok: true }, browser);
});

test("initial, revisit, and back navigation each beacon current path with one entry", async () => {
	const state = fixture();
	for (const path of ["/", "/links", "/"]) {
		state.location.pathname = path;
		state.dispatch("astro:page-load");
	}
	const sent = await bodies(state.sent);
	assert.deepEqual(sent.filter((event) => event.endpoint === "/api/visit").map((event) => event.body), [
		{ p: "/", r: "https://google.com/search?q=secret", e: 1 },
		{ p: "/links", r: "", e: 0 },
		{ p: "/", r: "", e: 0 },
	]);
	assert.deepEqual(state.fingerprints, ["/", "/links", "/"]);
});

test("entry remains initial-only when session storage is disabled", async () => {
	const state = fixture({ storageThrows: true });
	state.dispatch("astro:page-load");
	state.location.pathname = "/reading";
	state.dispatch("astro:page-load");
	assert.deepEqual((await bodies(state.sent)).filter((event) => event.endpoint === "/api/visit").map((event) => event.body.e), [1, 0]);
});

test("a blocked sessionStorage getter does not prevent tracking initialization", async () => {
	const state = fixture({ storageGetterThrows: true });
	state.dispatch("astro:page-load");
	state.location.pathname = "/links";
	state.dispatch("astro:page-load");
	assert.deepEqual((await bodies(state.sent)).map((event) => event.body.e), [1, 0]);
});

test("dev tabs are reinserted after every page swap without public beacons", () => {
	const state = fixture();
	state.location.hostname = "dev.merulox.com";
	state.dispatch("astro:page-load");
	state.dispatch("astro:page-load");
	assert.equal(state.devTabs, 2);
	assert.equal(state.sent.length, 0);
});

test("privacy opt-out suppresses page, fingerprint, and outbound events", () => {
	const state = fixture({ optOut: true });
	state.dispatch("astro:page-load");
	state.dispatch("click", { target: { closest: () => ({ href: "https://example.com/" }) } });
	assert.equal(state.sent.length, 0);
	assert.equal(state.fetched.length, 0);
	assert.equal(state.fingerprints.length, 0);
});

test("local notrack, GPC, and DNT opt-outs survive unavailable local storage", () => {
	const storage = new Map();
	const browser = {
		location: { search: "?notrack=1" },
		localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
		navigator: {},
	};
	assert.equal(privacyOptedOut(browser), true);
	browser.location.search = "";
	assert.equal(privacyOptedOut(browser), true);
	browser.location.search = "?notrack=1";
	browser.localStorage = { getItem: () => null, setItem: () => { throw new Error("disabled"); } };
	assert.equal(privacyOptedOut(browser), true);
	browser.location.search = "";
	browser.navigator.globalPrivacyControl = true;
	assert.equal(privacyOptedOut(browser), true);
	browser.navigator.globalPrivacyControl = false;
	browser.navigator.doNotTrack = "1";
	assert.equal(privacyOptedOut(browser), true);
});

test("external anchors track same-tab, new-tab, middle, and keyboard activations once each", async () => {
	const state = fixture();
	const anchor = (href, target = "") => ({ href, target });
	const activate = (type, link, extra = {}) => state.dispatch(type, { target: { closest: () => link }, ...extra });
	activate("click", anchor("https://one.example/a?token=secret#part"));
	activate("click", anchor("https://two.example/b", "_blank"), { ctrlKey: true });
	activate("click", anchor("https://three.example/c"), { button: 1 });
	activate("auxclick", anchor("https://three.example/c"), { button: 1 });
	activate("click", anchor("https://four.example/d"), { detail: 0 });
	activate("click", anchor("https://dev.merulox.com/visits"));
	activate("click", anchor("https://cancelled.example/media"), { defaultPrevented: true });
	const clicks = (await bodies(state.sent)).filter((event) => event.endpoint === "/api/outbound-click").map((event) => event.body);
	assert.deepEqual(clicks, [
		{ p: "/", d: "https://one.example/a" },
		{ p: "/", d: "https://two.example/b" },
		{ p: "/", d: "https://three.example/c" },
		{ p: "/", d: "https://four.example/d" },
	]);
});

test("destination sanitizer removes secrets and rejects internal or non-http links", () => {
	assert.equal(outboundDestination("https://user:pass@example.com/p?q=secret#x"), "https://example.com/p");
	for (const value of ["https://merulox.com/x", "https://dev.merulox.com/x", "mailto:a@example.com", "javascript:alert(1)"]) {
		assert.equal(outboundDestination(value), null);
	}
});
