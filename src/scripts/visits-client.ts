// Injected into every page by the astro.config.mjs `merulox-visits` integration.
// merulox.com: send one cookieless page-view beacon (geo is resolved at the edge).
// dev.merulox.com: add the dev-only "visits" tab to the navigation.
const DEV_HOST = "dev.merulox.com";
const TRACKED_HOSTS = ["merulox.com", "www.merulox.com"];
const OPT_OUT_KEY = "mx-notrack";
const SESSION_KEY = "mx-visit";

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

function addVisitsTab() {
	const current = location.pathname.replace(/\/$/, "") === "/visits";
	const arrow = '<span class="sel-arrow" aria-hidden="true">&gt;</span>';

	const siteNav = document.querySelector(".site-nav");
	if (siteNav && !siteNav.querySelector('a[href="/visits"]')) {
		const link = document.createElement("a");
		link.href = "/visits";
		link.className = "kbd-item";
		link.innerHTML = `${arrow} visits`;
		if (current) link.setAttribute("aria-current", "page");
		siteNav.append(link);
	}

	const selector = document.querySelector("#selector");
	if (selector && !selector.querySelector('a[href="/visits"]')) {
		const link = document.createElement("a");
		link.href = "/visits";
		link.className = "sel-item";
		link.dataset.index = String(selector.querySelectorAll(".sel-item").length);
		link.innerHTML = `${arrow}<span class="sel-label">visits</span>`;
		selector.append(link);
	}
}

if (location.hostname === DEV_HOST) addVisitsTab();
else if (TRACKED_HOSTS.includes(location.hostname)) sendBeacon();
