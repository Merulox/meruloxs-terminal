// Runs on chatgpt.com — pulls recent conversation titles via the app's own
// backend, exactly the way the ChatGPT web app does. No token extraction, no
// scraping: the access token comes from /api/auth/session (authed by the
// session cookie that's already present in this logged-in tab).
//
// Results are handed to the background worker, which POSTs them to
// merulox.com/api/chatgpt-log. Throttled so a normal browsing session doesn't
// hammer the endpoint on every navigation.

const THROTTLE_MS = 30 * 60 * 1000; // at most once per 30 min
const LAST_RUN_KEY = "chatgpt_last_run";
const LIMIT = 40;

function toEpoch(t) {
	if (t == null) return null;
	if (typeof t === "number") return t; // already epoch seconds
	const ms = Date.parse(t); // ISO-8601 string
	return Number.isNaN(ms) ? null : ms / 1000;
}

async function harvest() {
	try {
		// Throttle: skip if we ran recently.
		const { [LAST_RUN_KEY]: last } = await chrome.storage.local.get(LAST_RUN_KEY);
		if (last && Date.now() - last < THROTTLE_MS) return;

		const sess = await fetch("/api/auth/session", { credentials: "include" }).then((r) => r.json());
		const token = sess?.accessToken;
		if (!token) return; // not logged in / no session yet

		const res = await fetch(`/backend-api/conversations?offset=0&limit=${LIMIT}&order=updated`, {
			headers: { Authorization: `Bearer ${token}` },
			credentials: "include",
		});
		if (!res.ok) throw new Error(`conversations ${res.status}`);

		const data = await res.json();
		const items = (data.items || [])
			.map((c) => ({
				title: (c.title || "").trim(),
				update_time: toEpoch(c.update_time) ?? toEpoch(c.create_time),
			}))
			.filter((c) => c.title);

		await chrome.storage.local.set({ [LAST_RUN_KEY]: Date.now() });
		chrome.runtime.sendMessage({ action: "chatgptHistory", items });
	} catch (err) {
		chrome.runtime.sendMessage({ action: "chatgptHistory", items: [], error: String(err.message || err) });
	}
}

// Give the SPA a moment to settle, then harvest once.
setTimeout(harvest, 2500);
