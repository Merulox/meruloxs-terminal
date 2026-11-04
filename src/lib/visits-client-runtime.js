import { outboundDestination } from "./outbound-destination.js";

export const PUBLIC_HOSTS = new Set(["merulox.com", "www.merulox.com"]);

export function privacyOptedOut(browser = globalThis, key = "mx-notrack") {
	const flag = new URLSearchParams(browser.location.search).get("notrack");
	if (flag === "1") {
		try {
			browser.localStorage.setItem(key, "1");
		} catch {}
		return true;
	}
	try {
		if (flag === "0") browser.localStorage.removeItem(key);
		else if (browser.localStorage.getItem(key) === "1") return true;
	} catch {}
	return browser.navigator.globalPrivacyControl === true || browser.navigator.doNotTrack === "1";
}

export function sendWithFallback(endpoint, payload, browser = globalThis) {
	const body = JSON.stringify(payload);
	let queued = false;
	try {
		const blob = new browser.Blob([body], { type: "text/plain" });
		queued = browser.navigator.sendBeacon?.(endpoint, blob) === true;
	} catch {}
	if (!queued) {
		try {
			const result = browser.fetch(endpoint, { method: "POST", body, keepalive: true });
			result?.catch?.(() => {});
		} catch {}
	}
}

export function installVisitLifecycle({
	browser = globalThis,
	devHost = "dev.merulox.com",
	optedOut,
	addDevTabs,
	sendFingerprint,
	sessionKey = "mx-visit",
} = {}) {
	const { document, location } = browser;
	let entered = false;

	function entryFlag() {
		try {
			const sessionStorage = browser.sessionStorage;
			if (sessionStorage.getItem(sessionKey)) {
				entered = true;
				return 0;
			}
			sessionStorage.setItem(sessionKey, "1");
		} catch {}
		if (entered) return 0;
		entered = true;
		return 1;
	}

	function trackOutbound(event) {
		if (event.defaultPrevented) return;
		if (optedOut() || !PUBLIC_HOSTS.has(location.hostname)) return;
		if (event.type === "auxclick" && event.button !== 1) return;
		if (event.type === "click" && event.button !== 0) return;
		const target = event.target;
		const anchor = target?.closest?.("a[href]");
		if (!anchor) return;
		const destination = outboundDestination(anchor.href);
		if (!destination) return;
		sendWithFallback("/api/outbound-click", { p: location.pathname, d: destination }, browser);
	}

	function pageLoad() {
		if (location.hostname === devHost) {
			addDevTabs();
			return;
		}
		if (!PUBLIC_HOSTS.has(location.hostname) || optedOut()) return;
		const path = location.pathname;
		const entry = entryFlag();
		sendWithFallback("/api/visit", { p: path, r: entry ? document.referrer : "", e: entry }, browser);
		void sendFingerprint(path);
	}

	document.addEventListener("click", trackOutbound);
	document.addEventListener("auxclick", trackOutbound);
	document.addEventListener("astro:page-load", pageLoad);
	return { entryFlag, pageLoad, trackOutbound };
}
