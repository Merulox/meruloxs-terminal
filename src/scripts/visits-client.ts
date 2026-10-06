import { collectBrowserFingerprint } from "./fingerprint-client";

// Injected into every page by the astro.config.mjs `merulox-visits` integration.
// merulox.com: send one cookieless page-view beacon (geo is resolved at the edge).
// dev.merulox.com: add the dev-only "visits" tab to the navigation.
const DEV_HOST = "dev.merulox.com";
const TRACKED_HOSTS = ["merulox.com", "www.merulox.com"];
const OPT_OUT_KEY = "mx-notrack";
const SESSION_KEY = "mx-visit";
const FP_SESSION_KEY = "mx-fp-session";
const FP_CACHE_KEY = "mx-fp-cache";

function optedOut(): boolean {
	const flag = new URLSearchParams(location.search).get("notrack");
	try {
		if (flag === "1") localStorage.setItem(OPT_OUT_KEY, "1");
		if (flag === "0") localStorage.removeItem(OPT_OUT_KEY);
		if (localStorage.getItem(OPT_OUT_KEY) === "1") return true;
	} catch {}
	const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
	return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function sendBeacon() {
	if (optedOut()) return;
	let entry = 0;
	try {
		if (!sessionStorage.getItem(SESSION_KEY)) {
			sessionStorage.setItem(SESSION_KEY, "1");
			entry = 1;
		}
	} catch {}
	const body = JSON.stringify({ p: location.pathname, r: document.referrer, e: entry });
	const blob = new Blob([body], { type: "text/plain" });
	if (!navigator.sendBeacon?.("/api/visit", blob)) {
		fetch("/api/visit", { method: "POST", body, keepalive: true }).catch(() => {});
	}
}

function fingerprintSession() {
	try {
		const existing = sessionStorage.getItem(FP_SESSION_KEY);
		if (existing) return existing;
		const id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16).padStart(8, "0")).join("");
		sessionStorage.setItem(FP_SESSION_KEY, id);
		return id;
	} catch {
		return crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
	}
}

async function fingerprintSnapshot() {
	try {
		const cached = sessionStorage.getItem(FP_CACHE_KEY);
		if (cached) {
			const parsed: unknown = JSON.parse(cached);
			if (
				parsed &&
				typeof parsed === "object" &&
				"hash" in parsed &&
				typeof parsed.hash === "string" &&
				"attributes" in parsed &&
				parsed.attributes &&
				typeof parsed.attributes === "object" &&
				!Array.isArray(parsed.attributes)
			) {
				return { hash: parsed.hash, attributes: parsed.attributes };
			}
		}
	} catch {}
	const captured = await collectBrowserFingerprint();
	try {
		sessionStorage.setItem(FP_CACHE_KEY, JSON.stringify(captured));
	} catch {}
	return captured;
}

async function sendFingerprint() {
	if (optedOut()) return;
	const { attributes, hash } = await fingerprintSnapshot();
	const body = JSON.stringify({
		v: 1,
		p: location.pathname,
		sid: fingerprintSession(),
		hash,
		attributes,
	});
	if (new TextEncoder().encode(body).byteLength > 48_000) return;
	const blob = new Blob([body], { type: "text/plain" });
	if (!navigator.sendBeacon?.("/api/fingerprint", blob)) {
		fetch("/api/fingerprint", { method: "POST", body, keepalive: true }).catch(() => {});
	}
}

function addDevTabs() {
	const arrow = '<span class="sel-arrow" aria-hidden="true">&gt;</span>';
	const tabs = [
		{ href: "/visits", label: "visits" },
		{ href: "/cameras", label: "cameras" },
	];

	const siteNav = document.querySelector(".site-nav");
	if (siteNav) {
		for (const tab of tabs) {
			if (siteNav.querySelector(`a[href="${tab.href}"]`)) continue;
			const link = document.createElement("a");
			link.href = tab.href;
			link.className = "kbd-item";
			link.innerHTML = `${arrow} ${tab.label}`;
			if (location.pathname.replace(/\/$/, "") === tab.href) {
				link.setAttribute("aria-current", "page");
			}
			siteNav.append(link);
		}
	}

	const selector = document.querySelector("#selector");
	if (selector) {
		for (const tab of tabs) {
			if (selector.querySelector(`a[href="${tab.href}"]`)) continue;
			const link = document.createElement("a");
			link.href = tab.href;
			link.className = "sel-item";
			link.dataset.index = String(selector.querySelectorAll(".sel-item").length);
			link.innerHTML = `${arrow}<span class="sel-label">${tab.label}</span>`;
			selector.append(link);
		}
	}
}

if (location.hostname === DEV_HOST) addDevTabs();
else if (TRACKED_HOSTS.includes(location.hostname)) {
	sendBeacon();
	void sendFingerprint();
}
